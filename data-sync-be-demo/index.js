const express = require("express");
const path = require("path");
const fs = require("fs");

const { getTableMeta } = require("./table_meta.js");
const { getTableRecords } = require("./table_records.js");
const { judgeEncryptSignValid } = require("./request_sign.js");
const { kingdeeLogin, queryBusinessInfo, executeBillQuery, getKDSessionId } = require("./kingdee_api.js");
const { generateTableMeta } = require("./table_meta_generator.js");

const app = express();

// 添加 CORS 中间件，允许跨域请求
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, kdservice-sessionid');
    
    // 处理预检请求（OPTIONS）
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    
    next();
});

app.use(express.json());

app.get("/", (req, res) => {
    res.send("hello world");
});

app.get("/meta.json", (req, res) => {
    fs.readFile(
        path.join(__dirname, "./public/meta.json"),
        "utf8",
        (err, data) => {
            res.set("Content-Type", "application/json");
            res.status(200).send(data);
        },
    );
});

app.post("/api/table_meta", async (req, res) => {
    try {
        // 从请求中获取 params（params 是字符串，需要解析）
        let params;
        if (typeof req.body.params === 'string') {
            params = JSON.parse(req.body.params);
        } else {
            params = req.body.params;
        }
        
        // datasourceConfig 也是字符串，需要再次解析
        let datasourceConfig;
        if (typeof params.datasourceConfig === 'string') {
            datasourceConfig = JSON.parse(params.datasourceConfig);
        } else {
            datasourceConfig = params.datasourceConfig;
        }
        
        if (!datasourceConfig || !datasourceConfig.SelectedFields) {
            throw new Error('缺少必要的配置参数');
        }
        
        // 调用金蝶登录获取 SessionId
        const sessionId = await getKDSessionId(datasourceConfig);
        
        // 根据 SelectedFields 生成表结构
        const tableMeta = generateTableMeta(datasourceConfig);
        
        const result = { code: 0, message: "POST 请求成功", data: tableMeta };
        res.status(200).json(result);
    } catch (error) {
        console.error("生成表结构失败:", error.message);
        
        res.status(500).json({
            code: 500,
            message: error.message || "生成表结构失败",
            error: error.toString()
        });
    }
});

app.post("/api/records", async (req, res) => {
    try {
        
        // 从请求中获取 params（params 是字符串，需要解析）
        let params;
        if (typeof req.body.params === 'string') {
            params = JSON.parse(req.body.params);
        } else {
            params = req.body.params;
        }
        
        // datasourceConfig 也是字符串，需要再次解析
        let datasourceConfig;
        if (typeof params.datasourceConfig === 'string') {
            datasourceConfig = JSON.parse(params.datasourceConfig);
        } else {
            datasourceConfig = params.datasourceConfig;
        }
        
        if (!datasourceConfig || !datasourceConfig.SelectedFields) {
            throw new Error('缺少必要的配置参数');
        }
        
        // 解析出需要的字段 keys
        const selectedFields = datasourceConfig.SelectedFields || [];
        const fieldKeys = selectedFields.map(field => field.Key).join(',');
        
        // 获取主键字段名（可能是逗号分隔的多个字段）
        const pkFieldNameStr = datasourceConfig.PkFieldName || 'FID';
        const pkFieldKeys = pkFieldNameStr.split(',').map(key => key.trim());
        
        // 调用金蝶登录获取 SessionId
        const sessionId = await getKDSessionId(datasourceConfig);
        
        // 计算分页参数
        const defaultPageSize = 200; // 默认每页大小
        let pageIndex = 0;
        
        // 从 pageToken 获取当前页码
        if(params.pageToken !== undefined && params.pageToken !== null && params.pageToken !== ""){
            pageIndex = parseInt(params.pageToken, 10);
        }
        
        // 计算起始行号：优先使用 params.StartRow，否则根据 pageToken 计算
        let calculatedStartRow = 0;
        if (params.StartRow !== undefined && params.StartRow !== null) {
            // 如果前端传了 StartRow，直接使用（兼容首次同步）
            calculatedStartRow = params.StartRow;
        } else {
            // 否则根据 pageToken 计算（再次同步时使用）
            calculatedStartRow = pageIndex * defaultPageSize;
        }
        
        // 构建查询参数
        const queryParams = {
            serverUrl: datasourceConfig.ServerUrl,
            formId: datasourceConfig.SelectedFormId,
            fieldKeys: fieldKeys,
            sessionId: sessionId,
            limit: defaultPageSize,
            startRow: calculatedStartRow,
        };
        
        // 可选参数（如果前端传了就使用）
        if (datasourceConfig.FilterCondition) {
            queryParams.filterString = datasourceConfig.FilterCondition;
        }
        
        if (params.OrderString) {
            queryParams.orderString = params.OrderString;
        }
        
        if (params.TopRowCount !== undefined && params.TopRowCount !== null) {
            queryParams.topRowCount = params.TopRowCount;
        }
        
        if (params.Limit !== undefined && params.Limit !== null) {
            queryParams.limit = params.Limit;
        }
        
        // 调用 executeBillQuery 获取数据
        const result = await executeBillQuery(queryParams);
        
        // 将金蝶返回的二维数组转换为 getTableRecords 格式
        const formattedRecords = {
            nextPageToken: (pageIndex+1).toString(),
            hasMore: false,
            records: []
        };
        if(result.length ==queryParams.limit){
            formattedRecords.hasMore = true;
        }
        
        // result 本身就是数组格式
        if (Array.isArray(result)) {
            // 遍历每一行数据
            result.forEach((row, index) => {
                const record = {
                    primaryId: '',
                    data: {}
                };
                
                // 将数组值映射到字段
                if (Array.isArray(row)) {
                    selectedFields.forEach((field, fieldIndex) => {
                        const fieldId = field.Key; // 使用 Key 作为 fieldId
                        const fieldValue = row[fieldIndex];
                        record.data[fieldId] = fieldValue;
                    });
                    
                    // 根据 PkFieldName 生成 primaryId（用下划线拼接多个主键字段的值）
                    const pkValues = [];
                    pkFieldKeys.forEach(pkKey => {
                        // 找到主键字段在 selectedFields 中的索引
                        const pkFieldIndex = selectedFields.findIndex(f => f.Key === pkKey);
                        if (pkFieldIndex !== -1 && row[pkFieldIndex] !== undefined && row[pkFieldIndex] !== null) {
                            pkValues.push(String(row[pkFieldIndex]));
                        }
                    });
                    
                    // 如果找到了主键值，用下划线拼接；否则使用后备方案
                    if (pkValues.length > 0) {
                        record.primaryId = pkValues.join('_');
                    } else {
                        // 后备方案：使用索引
                        record.primaryId = `record_${calculatedStartRow + index + 1}`;
                    }
                }
                
                formattedRecords.records.push(record);
            });
        }
        
        // 返回结果
        res.status(200).json({
            code: 0,
            message: "POST 请求成功",
            data: formattedRecords
        });
    } catch (error) {
        console.error("查询记录失败:", error.message);
        
        res.status(500).json({
            code: 500,
            message: error.message || "查询记录失败",
            error: error.toString()
        });
    }
});

// 代理金蝶云星空元数据查询接口
app.post("/api/query-metadata", async (req, res) => {
    try {
        console.log("查询元数据的请求数据:", req.body);
        
        // 从 headers 中获取 sessionId
        const sessionId = req.headers['kdservice-sessionid'];
        console.log("sessionId from headers:", sessionId);
        
        // 从请求体中获取 formId 和 serverUrl（支持两种格式）
        let formId;
        let serverUrl = 'https://my.kingdee.com'; // 默认服务器地址
        
        if (req.body.formId) {
            // 旧格式：{ formId: "xxx", serverUrl: "xxx" }
            formId = req.body.formId;
            serverUrl = req.body.serverUrl || serverUrl;
        } else if (req.body.parameters && Array.isArray(req.body.parameters) && req.body.parameters[0]) {
            // 新格式：{ parameters: [{ FormId: "xxx" }] }
            formId = req.body.parameters[0].FormId;
        }
        
        console.log("解析后的参数:", { formId, serverUrl, sessionId });
        
        if (!formId) {
            return res.status(400).json({
                code: 400,
                message: "缺少必要参数：formId"
            });
        }
        
        // 调用金蝶 API
        const result = await queryBusinessInfo({
            serverUrl,
            formId,
            sessionId
        });
        
        res.status(200).json({
            code: 0,
            message: "查询成功",
            data: result
        });
    } catch (error) {
        console.error("查询元数据失败:", error);
        res.status(500).json({
            code: 500,
            message: error.message || "查询失败"
        });
    }
});

// 代理金蝶云星空登录接口
app.post("/api/login", async (req, res) => {
    try {
        console.log("=== 登录请求开始 ===");
        console.log("登录请求数据:", req.body);
        
        const { ServerUrl, AcctID, UserName, AppID, AppSec, LCID } = req.body;
        
        if (!ServerUrl || !AcctID || !AppID || !AppSec) {
            console.log("缺少必要参数:", { ServerUrl, AcctID, AppID, AppSec });
            return res.status(400).json({
                code: 400,
                message: "缺少必要参数"
            });
        }
        
        console.log("调用封装好的登录函数...");
        
        // 调用封装好的登录函数
        const result = await kingdeeLogin({
            serverUrl: ServerUrl,
            acctId: AcctID,
            userName: UserName || '',
            appId: AppID,
            appSec: AppSec,
            lcid: parseInt(LCID) || 2052
        });
        
        console.log("登录结果:", result);
        console.log("=== 登录请求结束 ===");
        
        // 返回给前端
        res.status(200).json(result);
    } catch (error) {
        console.error("=== 登录错误 ===");
        console.error("登录失败:", error);
        console.error("错误堆栈:", error.stack);
        
        res.status(500).json({
            code: 500,
            message: error.message || "登录失败",
            error: error.toString()
        });
    }
});

app.listen(9594, () => {
    console.log("Express server initialized");
});

// 保存配置到文件
app.post("/api/save-config", async (req, res) => {
    try {
        console.log("=== 保存配置请求开始 ===");
        console.log("保存配置的请求数据:", req.body);
        
        const { FileName, ...saveData } = req.body;
        
        if (!FileName) {
            return res.status(400).json({
                code: 400,
                message: "缺少文件名参数"
            });
        }
        
        // 确保 public 目录存在
        const publicDir = path.join(__dirname, "./public");
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        
        // 构建文件路径
        const filePath = path.join(publicDir, FileName);
        
        console.log("保存文件路径:", filePath);
        console.log("保存的数据:", saveData);
        
        // 将数据写入文件
        fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf8');
        
        console.log("文件保存成功:", filePath);
        console.log("=== 保存配置请求结束 ===");
        
        res.status(200).json({
            code: 0,
            message: "保存成功",
            data: {
                fileName: FileName,
                filePath: filePath
            }
        });
    } catch (error) {
        console.error("=== 保存配置错误 ===");
        console.error("保存配置失败:", error);
        res.status(500).json({
            code: 500,
            message: error.message || "保存失败",
            error: error.toString()
        });
    }
});
