const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const crypto = require('crypto');

/**
 * 金蝶云星空登录接口
 * @param {Object} params - 登录参数
 * @param {string} params.serverUrl - 金蝶服务器地址
 * @param {string} params.acctId - 账套 ID
 * @param {string} params.userName - 用户名
 * @param {string} params.appId - 应用 ID
 * @param {string} params.appSec - 应用密钥
 * @param {number} params.lcid - 语言 ID
 * @returns {Promise<Object>} - 返回登录结果
 */
async function kingdeeLogin({ serverUrl, acctId, userName, appId, appSec, lcid }) {
    try {
        // 生成秒级时间戳
        const timestamp = Math.floor(Date.now() / 1000).toString();
        
        // ========== 严格按照前端逻辑生成签名 ==========
        // 1. 将参数放入数组（与前端完全一致）
        let arr = [acctId, userName, appId, appSec, timestamp];
        
        // 2. 排序（字母顺序，与前端 JavaScript 默认排序一致）
        arr.sort();
        
        // 3. 拼接成字符串（与前端完全一致）
        const signString = arr.join('');
        
        // 4. 使用 SHA256 加密（Node.js crypto 与 Web Crypto API 结果一致）
        const hash = crypto.createHash('sha256');
        hash.update(signString);
        const sign = hash.digest('hex');
        // ============================================
        
        console.log('登录参数:', {
            serverUrl,
            acctId,
            userName,
            appId,
            timestamp,
            sign,
            lcid
        });
        
        // 构建登录 URL
        const url = `${serverUrl}/K3Cloud/Kingdee.BOS.WebApi.ServicesStub.AuthService.LoginBySign.common.kdsvc`;
        
        // 构建请求参数（注意顺序：账套 ID、用户名、应用 ID、时间戳、签名、语言 ID）
        const parameters = [acctId, userName, appId, timestamp, sign, lcid || 2052];
        
        console.log('调用金蝶登录接口:', {
            url,
            parameters
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                parameters
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('金蝶登录响应:', result);
        
        return result;
    } catch (error) {
        console.error('金蝶登录失败:', error);
        throw error;
    }
}

/**
 * 查询金蝶云星空元数据接口
 * @param {Object} params - 请求参数
 * @param {string} params.serverUrl - 金蝶服务器地址
 * @param {string} params.formId - 业务对象表单 ID
 * @param {string} params.sessionId - 会话 ID
 * @returns {Promise<Object>} - 返回元数据结果
 */
async function queryBusinessInfo({ serverUrl, formId, sessionId }) {
    try {
        const url = `${serverUrl}/K3Cloud/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.QueryBusinessInfo.common.kdsvc`;
        
        const requestBody = {
            FormId: formId
        };

        console.log('调用金蝶元数据接口:', {
            url,
            formId,
            sessionId
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'kdservice-sessionid': sessionId || ''
            },
            body: JSON.stringify({
                data: JSON.stringify(requestBody)
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('金蝶元数据响应:', result);
        
        return result;
    } catch (error) {
        console.error('查询金蝶元数据失败:', error);
        throw error;
    }
}

/**
 * 执行金蝶云星空单据查询接口（ExecuteBillQuery）
 * @param {Object} params - 请求参数
 * @param {string} params.serverUrl - 金蝶服务器地址
 * @param {string} params.formId - 业务对象表单 ID（必录）
 * @param {string} params.fieldKeys - 需查询的字段 key 集合，格式："key1,key2,..."（必录）
 * @param {string|Array} params.filterString - 过滤条件，字符串或数组（非必录）
 * @param {string} params.orderString - 排序字段（非必录）
 * @param {number} params.topRowCount - 返回总行数，0 表示不限制（非必录）
 * @param {number} params.startRow - 开始行索引，从 0 开始（非必录）
 * @param {number} params.limit - 最大行数，不能超过 2000（非必录）
 * @param {string} params.sessionId - 会话 ID（非必录）
 * @returns {Promise<Object>} - 返回查询结果 List<List<object>>
 */
async function executeBillQuery({ 
    serverUrl, 
    formId, 
    fieldKeys, 
    filterString, 
    orderString, 
    topRowCount,
    startRow, 
    limit,
    sessionId 
}) {
    try {
        const url = `${serverUrl}/K3Cloud/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc`;
        
        // 构建查询参数
        const queryParams = {
            FormId: formId
        };
        
        // 必填参数
        if (fieldKeys) {
            queryParams.FieldKeys = fieldKeys;
        } else {
            throw new Error('FieldKeys 是必填参数');
        }
        
        // 可选参数
        if (filterString !== undefined && filterString !== null) {
            queryParams.FilterString = Array.isArray(filterString) 
                ? JSON.stringify(filterString) 
                : filterString;
        }
        
        if (orderString) {
            queryParams.OrderString = orderString;
        }
        
        if (topRowCount !== undefined && topRowCount !== null) {
            queryParams.TopRowCount = topRowCount;
        }
        
        if (startRow !== undefined && startRow !== null) {
            queryParams.StartRow = startRow;
        }
        
        if (limit !== undefined && limit !== null) {
            if (limit > 2000) {
                console.warn('Limit 超过 2000，已自动调整为 2000');
                queryParams.Limit = 2000;
            } else {
                queryParams.Limit = limit;
            }
        }
        
        const requestBody = queryParams;

        console.log('调用金蝶单据查询接口:', {
            url,
            formId,
            fieldKeys,
            filterString,
            orderString,
            topRowCount,
            startRow,
            limit,
            sessionId
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'kdservice-sessionid': sessionId || ''
            },
            body: JSON.stringify({
                data: JSON.stringify(requestBody)
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('金蝶单据查询响应:', result);
        
        return result;
    } catch (error) {
        console.error('执行金蝶单据查询失败:', error);
        throw error;
    }
}

/**
 * 从 datasourceConfig 获取金蝶 SessionId
 * @param {Object} datasourceConfig - 数据源配置对象
 * @param {string} datasourceConfig.ServerUrl - 金蝶服务器地址
 * @param {string} datasourceConfig.AcctID - 账套 ID
 * @param {string} datasourceConfig.UserName - 用户名
 * @param {string} datasourceConfig.AppID - 应用 ID
 * @param {string} datasourceConfig.AppSec - 应用密钥
 * @param {string|number} datasourceConfig.LCID - 语言 ID
 * @returns {Promise<string>} - 返回 SessionId，失败返回空字符串
 */
async function getKDSessionId(datasourceConfig) {
    try {
        console.log('调用金蝶登录获取 SessionId...');
        const loginResult = await kingdeeLogin({
            serverUrl: datasourceConfig.ServerUrl,
            acctId: datasourceConfig.AcctID,
            userName: datasourceConfig.UserName || '',
            appId: datasourceConfig.AppID,
            appSec: datasourceConfig.AppSec,
            lcid: parseInt(datasourceConfig.LCID) || 2052
        });
        
        if (loginResult.LoginResultType === 1 && loginResult.KDSVCSessionId) {
            const sessionId = loginResult.KDSVCSessionId;
            console.log('登录成功，SessionId:', sessionId);
            return sessionId;
        } else {
            console.warn('登录未返回 SessionId');
            return '';
        }
    } catch (error) {
        console.error('登录失败:', error.message);
        return '';
    }
}

module.exports = {
    kingdeeLogin,
    queryBusinessInfo,
    executeBillQuery,
    getKDSessionId
};
