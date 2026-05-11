import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Form, Input, Table, message, Spin, Typography, Space, Checkbox, Select, Divider, Collapse, Tag, Modal } from 'antd';
import { bitable } from '@lark-base-open/connector-api';
import { API_ENDPOINTS, APP_CONFIG } from './config';

const { Title } = Typography;

interface FormData {
    ServerUrl: string;
    AcctID: string;
    UserName: string;
    AppID: string;
    AppSec: string;
    LCID: string;
    OrgNum: string;
}

interface FormItem {
    formId: string;
    formName: string;
}

interface MetadataField {
    Key: string;
    FieldName: string;
    PropertyName: string;
    Name: string;
    EntityKey: string;
    EntityName: string;
    DataType: any; // 改为 any 以支持文本类型名称
    ElementType?: number; // 可选，金蝶原始类型代码
    FieldType?: number; // 可选，飞书字段类型
    Property?: any; // 可选，属性配置
    PkFieldName?: string; // 可选，主键字段名
    checked?: boolean; // 用于复选框状态
}

export default function FormSelect() {
    const [form] = Form.useForm();
    const location = useLocation();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formsList, setFormsList] = useState<FormItem[]>([]);
    const [filteredForms, setFilteredForms] = useState<FormItem[]>([]);
    const [selectedForm, setSelectedForm] = useState<string>('');
    const [metadataLoading, setMetadataLoading] = useState(false);
    const [fields, setFields] = useState<MetadataField[]>([]);
    const [languageId, setLanguageId] = useState<number>(APP_CONFIG.DEFAULT_LANGUAGE_ID); // 默认简体中文
    const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>([]); // 用户选择的字段
    const [formsPanelExpanded, setFormsPanelExpanded] = useState<boolean>(true); // 单据列表展开状态
    const [fieldSearchText, setFieldSearchText] = useState<string>(''); // 字段搜索关键词
    const [fieldsPanelExpanded, setFieldsPanelExpanded] = useState<boolean>(true); // 字段列表展开状态
    const [showSelectedOnly, setShowSelectedOnly] = useState<boolean>(false); // 是否只显示已选字段
    const [kingdeeFieldTypeMap, setKingdeeFieldTypeMap] = useState<any>({}); // 金蝶字段类型映射
    const [pkFieldName, setPkFieldName] = useState<string>('FID'); // 单据主键字段名
    const [pkFieldElementType, setPkFieldElementType] = useState<number>(3); // 主键字段 ElementType（默认 3=整数）
    const [pkFieldDataType, setPkFieldDataType] = useState<string>('整数'); // 主键字段 DataType 名称
    const [pkFieldProperty, setPkFieldProperty] = useState<any>({ formatter: "#0" }); // 主键字段 Property
    const [filterCondition, setFilterCondition] = useState<string>(''); // 过滤条件
    const [isCreate, setIsCreate] = useState<boolean>(true); // 是否为新增模式
    const [customFormId, setCustomFormId] = useState<string>(''); // 用户自定义表单 ID
    const [savedConfig, setSavedConfig] = useState<any>(null); // 保存的配置（修改模式）
    const [editModalVisible, setEditModalVisible] = useState<boolean>(false); // 编辑模态框显示状态
    const [editJsonData, setEditJsonData] = useState<string>(''); // 编辑的 JSON 数据

    useEffect(() => {
        // 获取上一步传递的配置数据
        const sessionId = location.state?.sessionId;
        const isCreateMode = location.state?.isCreate ?? true; // 默认为新增模式
        const passedConfig = location.state?.config; // 从 App.tsx 传递的配置
        
        // 保存 isCreate 到 state
        setIsCreate(isCreateMode);
        console.log('当前模式:', isCreateMode ? '新增' : '修改');
        
        // 从 bitable.getConfig() 获取配置
        bitable.getConfig().then(config => {
            console.log('bitable.getConfig() 返回的配置:', config);
            
            if (config) {
                form.setFieldsValue(config);
                
                // 如果是修改模式，保存配置并恢复已选择的表单和字段
                if (!isCreateMode) {
                    console.log('修改模式：恢复已保存的配置');
                    setSavedConfig(config); // 保存配置供后续使用
                    
                    // 恢复过滤条件
                    if (config.FilterCondition) {
                        setFilterCondition(config.FilterCondition);
                        console.log('恢复过滤条件:', config.FilterCondition);
                    }
                    
                    message.success('配置已加载，请重新登录验证后继续操作');
                } else {
                    console.log('新增模式：使用空配置');
                }
            }
            
            // 如果是新增模式且有传递的配置，使用传递的配置
            if (isCreateMode && passedConfig) {
                console.log('新增模式：使用传递的配置', passedConfig);
                form.setFieldsValue(passedConfig);
            }
            
            // 配置加载完成后，再加载单据列表（使用局部变量，避免 state 异步问题）
            loadForms(isCreateMode, !isCreateMode ? config : null);
        });
        
        // 保存 sessionId 到 localStorage 以便后续使用
        if (sessionId) {
            sessionStorage.setItem('kdsSessionId', sessionId);
        }
        
        // 加载金蝶字段类型映射
        fetch('/kingdee_field_types.json')
            .then(res => res.json())
            .then(data => {
                setKingdeeFieldTypeMap(data.fieldTypeMap);
                console.log('金蝶字段类型映射已加载');
            })
            .catch(err => console.error('加载字段类型映射失败:', err));
    }, []);

    // 加载单据列表
    const loadForms = async (currentIsCreate: boolean, currentSavedConfig: any) => {
        try {
            const response = await fetch('/forms.json');
            const data = await response.json();
            setFormsList(data.forms);
            setFilteredForms(data.forms);
            
            // 如果是修改模式且有已选择的表单 ID，自动选中并过滤
            if (!currentIsCreate && currentSavedConfig && currentSavedConfig.SelectedFormId) {
                const selectedFormId = currentSavedConfig.SelectedFormId;
                
                // 设置过滤框内容
                setCustomFormId(selectedFormId);
                
                // 触发过滤，显示匹配的单据
                const keyword = selectedFormId.toLowerCase();
                const filtered = data.forms.filter((form: FormItem) => 
                    form.formId.toLowerCase().includes(keyword) || 
                    form.formName.toLowerCase().includes(keyword)
                );
                setFilteredForms(filtered);
                
                // 自动选中已保存的单据
                setSelectedForm(selectedFormId);
                console.log('修改模式：自动选中单据', selectedFormId);
            }
        } catch (error) {
            console.error('加载表单列表失败:', error);
            message.error('加载表单列表失败');
        }
    };

    // 过滤单据
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const keyword = e.target.value.toLowerCase();
        setCustomFormId(e.target.value); // 保存用户输入
        const filtered = formsList.filter(form => 
            form.formId.toLowerCase().includes(keyword) || 
            form.formName.toLowerCase().includes(keyword)
        );
        setFilteredForms(filtered);
    };

    // 选择单据
    const handleSelectForm = async (formId: string) => {
        setSelectedForm(formId);
        // 选择单据后收起单据列表面板
        setFormsPanelExpanded(false);
        message.success(`已选择单据：${formId}`);
        
        // 清空已选字段（如果是修改模式且单据与配置一致，会在查询完字段后自动恢复）
        setSelectedFieldKeys([]);
        
        // 自动查询字段
        const formData = form.getFieldsValue();
        if (!formData.ServerUrl || !formData.AcctID || !formData.AppID || !formData.AppSec) {
            message.warning('配置信息不完整，请返回上一步填写');
            return;
        }
        
        setMetadataLoading(true);
        try {
            // 从 sessionStorage 获取 SessionId
            const sessionId = sessionStorage.getItem('kdsSessionId');
            
            // 调用后端代理接口（避免 CORS 问题）
            const backendUrl = API_ENDPOINTS.QUERY_METADATA;
            
            console.log('请求后端代理:', {
                backendUrl,
                serverUrl: formData.ServerUrl,
                formId: formId,
                sessionId
            });

            // 构建 headers 对象
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            
            if (sessionId) {
                headers['kdservice-sessionid'] = sessionId;
            }
            
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({  
                    formId: formId,
                    serverUrl: formData.ServerUrl
                })
            });

            const result = await response.json();
            debugger;
            console.log('后端代理响应:', result);

            if (result.code === 0 && result.data) {
                // 处理返回的金蝶 API 结果
                const kingdeeResult = result.data;
                
                if (kingdeeResult.Result && kingdeeResult.Result.ResponseStatus && kingdeeResult.Result.ResponseStatus.IsSuccess) {
                    // 从返回结果中提取字段信息
                    const needReturnData = kingdeeResult.Result.NeedReturnData;
                    
                    console.log('NeedReturnData:', needReturnData);
                    
                    // 获取单据主键字段
                    const pkFieldName = needReturnData.PkFieldName || 'FID';
                    const pkFieldType = needReturnData.PkFieldType; // 获取主键字段类型
                    
                    console.log('=== 查询到单据主键字段 ===');
                    console.log('pkFieldName:', pkFieldName);
                    console.log('needReturnData.PkFieldName:', needReturnData.PkFieldName);
                    console.log('needReturnData.PkFieldType:', pkFieldType);
                    debugger;
                    
                    // 根据 PkFieldType 匹配金蝶字段类型
                    let pkElementType = 3; // 默认整数类型
                    let pkDataTypeName = '整数';
                    let pkProperty = { formatter: "#0" };
                    
                    if (pkFieldType) {
                        // 解析 .NET 类型字符串，例如："System.Int32, mscorlib, ..."
                        const typeMatch = pkFieldType.match(/System\.(\w+)/);
                        if (typeMatch) {
                            const systemType = typeMatch[1];
                            console.log('解析出的 .NET 类型:', systemType);
                            
                            // 根据 .NET 类型映射到金蝶 ElementType
                            const typeMapping: Record<string, number> = {
                                'Int32': 3,      // 整数
                                'Int64': 3,      // 整数
                                'Int16': 3,      // 整数
                                'String': 1,     // 文本
                                'Decimal': 2,    // 小数
                                'Double': 2,     // 小数
                                'Single': 2,     // 小数
                                'Boolean': 8,    // 复选框
                                'DateTime': 4,   // 日期
                            };
                            
                            if (typeMapping[systemType]) {
                                pkElementType = typeMapping[systemType];
                                
                                // 从 kingdeeFieldTypeMap 中获取对应的配置
                                const typeConfig = kingdeeFieldTypeMap[String(pkElementType)];
                                if (typeConfig) {
                                    pkDataTypeName = typeConfig.name;
                                    pkProperty = typeConfig.property || {};
                                }
                                
                                console.log('匹配到的金蝶字段类型:', {
                                    ElementType: pkElementType,
                                    DataType: pkDataTypeName,
                                    Property: pkProperty
                                });
                            }
                        }
                    }
                    
                    // 保存主键字段信息到 state（供后续构建默认主键字段时使用）
                    setPkFieldName(pkFieldName);
                    setPkFieldElementType(pkElementType);
                    setPkFieldDataType(pkDataTypeName);
                    setPkFieldProperty(pkProperty);
                    console.log('已设置 pkFieldName state:', pkFieldName);
                    console.log('已设置主键字段类型信息:', { ElementType: pkElementType, DataType: pkDataTypeName, Property: pkProperty });
                    
                    // 解析字段信息（支持多种数据结构）
                    let fieldList: MetadataField[] = [];
                    
                    // 辅助函数：根据语言 ID 获取名称
                    const getNameByLanguageId = (nameArray: any[], langId: number): string => {
                        if (!nameArray || !Array.isArray(nameArray)) return '';
                        const nameObj = nameArray.find((n: any) => n.Key === langId);
                        return nameObj ? nameObj.Value : '';
                    };
                    
                    // 情况 1: 直接包含 Fields 数组
                    if (needReturnData.Fields) {
                        fieldList = needReturnData.Fields.map((field: any) => {
                            const elementType = field.ElementType || field.elementType || 0;
                            let dataTypeName = '文本'; // 默认值
                            let fieldType = 1; // 默认飞书字段类型：文本
                            let property = {}; // 默认属性
                            
                            // 使用 ElementType 来判断数据类型（从 JSON 配置中读取）
                            if (kingdeeFieldTypeMap[elementType]) {
                                dataTypeName = kingdeeFieldTypeMap[elementType].name;
                                fieldType = kingdeeFieldTypeMap[elementType].fieldType;
                                property = kingdeeFieldTypeMap[elementType].property || {};
                            }
                            
                            return {
                                Key: field.Key || field.key,
                                FieldName: field.FieldName || field.fieldName || '',
                                PropertyName: field.PropertyName || field.propertyName || '',
                                Name: getNameByLanguageId(field.Name, languageId) || field.Key || '未知字段',
                                EntityKey: field.EntityKey || field.entityKey || '',
                                EntityName: field.EntityName || field.entityName || '',
                                DataType: dataTypeName,
                                ElementType: elementType,
                                FieldType: fieldType, // 保存飞书字段类型用于后续处理，但不显示
                                Property: property, // 保存属性配置用于后续处理，但不显示
                                PkFieldName: pkFieldName // 保存主键字段名
                            };
                        });
                    }
                    // 情况 2: 包含 Entrys 数组，每个 entry 有自己的 Fields
                    else if (needReturnData.Entrys && Array.isArray(needReturnData.Entrys)) {
                        console.log('从 Entrys 中提取字段，Entrys 数量:', needReturnData.Entrys.length);
                        // 遍历所有 entry（可能有多个单据体）
                        needReturnData.Entrys.forEach((entry: any, index: number) => {
                            console.log(`处理 Entry ${index}:`, entry.Key);
                            if (entry.Fields && Array.isArray(entry.Fields)) {
                                console.log(`  Entry ${entry.Key} 包含 ${entry.Fields.length} 个字段`);
                                const entryFields = entry.Fields.map((field: any) => {
                                    // 将金蝶的 ElementType 转换为前端显示的字段类型名称
                                    let dataTypeName = '文本'; // 默认值
                                    let fieldType = 1; // 默认飞书字段类型：文本
                                    let property = {}; // 默认属性
                                    const elementType = field.ElementType;
                                    
                                    // 使用 ElementType 来判断数据类型（从 JSON 配置中读取）
                                    if (kingdeeFieldTypeMap[elementType]) {
                                        dataTypeName = kingdeeFieldTypeMap[elementType].name;
                                        fieldType = kingdeeFieldTypeMap[elementType].fieldType;
                                        property = kingdeeFieldTypeMap[elementType].property || {};
                                    }
                                    
                                    return {
                                        Key: field.Key || field.key,
                                        FieldName: field.FieldName || field.fieldName || '',
                                        PropertyName: field.PropertyName || field.propertyName || '',
                                        Name: getNameByLanguageId(field.Name, languageId) || field.Key || '未知字段',
                                        EntityKey: field.EntityKey || field.entityKey || entry.Key || '',
                                        EntityName: (() => {
                                            // 从 Entry 的 Name 数组中获取实体名称
                                            if (entry.Name && Array.isArray(entry.Name)) {
                                                return getNameByLanguageId(entry.Name, languageId);
                                            }
                                            return entry.EntryName || entry.entryName || '';
                                        })(),
                                        DataType: dataTypeName,
                                        ElementType: elementType, // 保存 ElementType 用于后续处理，但不显示
                                        FieldType: fieldType, // 保存飞书字段类型用于后续处理，但不显示
                                        Property: property, // 保存属性配置用于后续处理，但不显示
                                        PkFieldName: pkFieldName // 保存主键字段名
                                    };
                                });
                                console.log(`  Entry ${entry.Key} 解析后得到 ${entryFields.length} 个字段`);
                                fieldList = fieldList.concat(entryFields);
                            }
                        });
                        console.log('所有 Entrys 解析完成，总字段数:', fieldList.length);
                    }
                    // 情况 3: 直接是数组
                    else if (Array.isArray(needReturnData)) {
                        fieldList = needReturnData.map((item: any) => {
                            const elementType = item.ElementType || item.elementType || 0;
                            let dataTypeName = '文本'; // 默认值
                            let fieldType = 1; // 默认飞书字段类型：文本
                            let property = {}; // 默认属性
                            
                            // 使用 ElementType 来判断数据类型（从 JSON 配置中读取）
                            if (kingdeeFieldTypeMap[elementType]) {
                                dataTypeName = kingdeeFieldTypeMap[elementType].name;
                                fieldType = kingdeeFieldTypeMap[elementType].fieldType;
                                property = kingdeeFieldTypeMap[elementType].property || {};
                            }
                            
                            return {
                                Key: item.Key || item.key || item.FieldKey,
                                FieldName: item.FieldName || item.fieldName || '',
                                PropertyName: item.PropertyName || item.propertyName || '',
                                Name: item.Caption || item.caption || item.FieldName || item.Key || '未知字段',
                                EntityKey: item.EntityKey || item.entityKey || '',
                                EntityName: item.EntityName || item.entityName || '',
                                DataType: dataTypeName,
                                ElementType: elementType,
                                FieldType: fieldType, // 保存飞书字段类型用于后续处理，但不显示
                                Property: property, // 保存属性配置用于后续处理，但不显示
                                PkFieldName: pkFieldName // 保存主键字段名
                            };
                        });
                    }

                    console.log('解析后的字段列表:', fieldList);

                    if (fieldList.length > 0) {
                        setFields(fieldList);
                        message.success(`查询到 ${fieldList.length} 个字段`);
                        
                        // 如果是修改模式，且当前选择的单据与配置中一致，恢复已选字段
                        // 注意：使用 formId 参数而不是 selectedForm state，避免异步问题
                        if (!isCreate && savedConfig && savedConfig.SelectedFormId === formId) {
                            if (savedConfig.SelectedFields && Array.isArray(savedConfig.SelectedFields)) {
                                const savedFieldKeys = savedConfig.SelectedFields.map((field: any) => field.Key);
                                // 过滤出存在的字段
                                const validFieldKeys = savedFieldKeys.filter((key: string) => 
                                    fieldList.some(field => field.Key === key)
                                );
                                setSelectedFieldKeys(validFieldKeys);
                                console.log('修改模式：恢复已选字段', validFieldKeys.length, '个');
                            }
                        } else {
                            console.log('修改模式：选择了其他单据，不恢复字段');
                        }
                    } else {
                        message.info('未找到字段信息');
                        setFields([]);
                    }
                } else {
                    const errors = kingdeeResult.Result?.ResponseStatus?.Errors || [];
                    const errorMsg = errors.length > 0 ? errors.join('; ') : '查询失败';
                    message.error(errorMsg);
                }
            } else {
                message.error(result.message || '查询失败');
            }
        } catch (error: any) {
            console.error('查询元数据失败:', error);
            message.error(`查询失败：${error.message}`);
        } finally {
            setMetadataLoading(false);
        }
    };

    // 打开编辑 JSON 对话框
    const handleOpenEditModal = () => {
        if (!selectedForm) {
            message.warning('请先选择单据类型');
            return;
        }
        
        if (selectedFieldKeys.length === 0) {
            message.warning('请至少选择一个字段');
            return;
        }
        
        const formData = form.getFieldsValue();
        
        // 只保存用户选择的字段
        let selectedFields = fields.filter(field => selectedFieldKeys.includes(field.Key));
        
        // 将主键字段添加到第一个位置
        let pkField = fields.find(field => field.Key === pkFieldName);
        
        console.log('=== 开始处理主键字段 ===');
        console.log('pkFieldName:', pkFieldName);
        console.log('fields 中找到的 pkField:', pkField);
        debugger;
        
        if (pkField) {
            console.log('主键字段已存在，进行去重和置顶处理');
            // 确保主键字段不重复（如果已经在 selectedFields 中，先移除）
            const filteredSelectedFields = selectedFields.filter(f => f.Key !== pkFieldName);
            // 将主键字段放到第一位
            selectedFields = [pkField, ...filteredSelectedFields];
            console.log('处理后的 selectedFields:', selectedFields);
        } else {
            console.log('主键字段不存在，构建默认主键字段对象');
            debugger;
            // 如果 fields 中没有找到主键字段，则构建一个默认的 MetadataField 对象
            // 使用从 PkFieldType 解析出的类型信息
            pkField = {
                Key: pkFieldName,
                FieldName: pkFieldName,
                PropertyName: '',
                Name: 'ID',
                EntityKey: '',
                EntityName: '',
                DataType: pkFieldDataType, // 使用解析出的数据类型
                ElementType: pkFieldElementType, // 使用解析出的 ElementType
                FieldType: 2, // 飞书字段类型：数字（整数和小数都是 2）
                Property: pkFieldProperty, // 使用解析出的 Property 配置
                PkFieldName: pkFieldName
            };
            console.log('构建的默认主键字段:', pkField);
            console.log('使用的类型配置:', { DataType: pkFieldDataType, ElementType: pkFieldElementType, Property: pkFieldProperty });
            // 将构建的主键字段放到第一位
            selectedFields = [pkField, ...selectedFields];
            console.log('添加默认主键后的 selectedFields:', selectedFields);
        }
        
        console.log('=== 主键字段处理完成 ===');
        debugger;
        
        const saveData = {
            ...formData,
            SelectedFormId: selectedForm,
            SelectedFields: selectedFields,
            PkFieldName: pkFieldName || 'FID',
            FilterCondition: filterCondition // 过滤条件
        };
        
        // 设置编辑的 JSON 数据（格式化显示）
        setEditJsonData(JSON.stringify(saveData, null, 2));
        setEditModalVisible(true);
    };

    // 保存编辑后的 JSON 数据
    const handleSaveEditedJson = async () => {
        try {
            // 解析编辑后的 JSON
            const parsedData = JSON.parse(editJsonData);
            
            console.log('保存编辑后的配置:', parsedData);
            
            // 获取飞书信息
            const baseUserId = await bitable.getUserId();
            const tenantKey = await bitable.getTenantKey();
            
            // 生成时间戳作为唯一标识
            const yn3xTableId = Date.now().toString();
            
            console.log('飞书信息:', { baseUserId, tenantKey });
            console.log('生成的 3xtableid:', yn3xTableId);
            
            // 构建文件名（包含 3xtableid）
            const fileName = `${tenantKey}_${yn3xTableId}_Para.json`;
            
            // 准备保存到后端的数据
            const backendSaveData = {
                ...parsedData,
                BaseUserId: baseUserId,
                TenantKey: tenantKey,
                FileName: fileName,
                Yn3xTableId: yn3xTableId
            };
            
            console.log('准备保存配置到后端:', backendSaveData);
            
            // 如果启用了保存到 public 目录，调用后端接口
            if (APP_CONFIG.ENABLE_SAVE_TO_PUBLIC) {
                // 调用后端接口保存配置
                const response = await fetch(API_ENDPOINTS.SAVE_CONFIG, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(backendSaveData)
                });
                
                const result = await response.json();
                console.log('后端保存结果:', result);
                
                if (result.code !== 0) {
                    throw new Error(result.message || '保存到后端失败');
                }
                
                console.log('后端保存成功，文件名为:', fileName);
            } else {
                console.log('已禁用保存到 public 目录，仅保存到飞书配置');
            }
            
            // 关闭编辑对话框
            setEditModalVisible(false);
            
            // 保存到飞书多维表格配置（与正常保存保持一致）
            await bitable.saveConfigAndGoNext(backendSaveData);
            
            message.success('配置已保存');
        } catch (error: any) {
            console.error('保存配置失败:', error);
            message.error(`保存失败：${error.message}`);
        }
    };

    // 保存并继续
    const handleSaveAndContinue = async () => {
        if (!selectedForm) {
            message.warning('请先选择单据类型');
            return;
        }
        
        if (selectedFieldKeys.length === 0) {
            message.warning('请至少选择一个字段');
            return;
        }
        
        const formData = form.getFieldsValue();
        
        // 只保存用户选择的字段
        let selectedFields = fields.filter(field => selectedFieldKeys.includes(field.Key));
        
        // 将主键字段添加到第一个位置
        let pkField = fields.find(field => field.Key === pkFieldName);
        
        console.log('=== [handleSaveAndContinue] 开始处理主键字段 ===');
        console.log('pkFieldName:', pkFieldName);
        console.log('fields 中找到的 pkField:', pkField);
        debugger;
        
        if (pkField) {
            console.log('主键字段已存在，进行去重和置顶处理');
            // 确保主键字段不重复（如果已经在 selectedFields 中，先移除）
            const filteredSelectedFields = selectedFields.filter(f => f.Key !== pkFieldName);
            // 将主键字段放到第一位
            selectedFields = [pkField, ...filteredSelectedFields];
            console.log('处理后的 selectedFields:', selectedFields);
        } else {
            console.log('主键字段不存在，构建默认主键字段对象');
            debugger;
            // 如果 fields 中没有找到主键字段，则构建一个默认的 MetadataField 对象
            // 使用从 PkFieldType 解析出的类型信息
            pkField = {
                Key: pkFieldName,
                FieldName: pkFieldName,
                PropertyName: '',
                Name: 'ID',
                EntityKey: '',
                EntityName: '',
                DataType: pkFieldDataType, // 使用解析出的数据类型
                ElementType: pkFieldElementType, // 使用解析出的 ElementType
                FieldType: 2, // 飞书字段类型：数字（整数和小数都是 2）
                Property: pkFieldProperty, // 使用解析出的 Property 配置
                PkFieldName: pkFieldName
            };
            console.log('构建的默认主键字段:', pkField);
            console.log('使用的类型配置:', { DataType: pkFieldDataType, ElementType: pkFieldElementType, Property: pkFieldProperty });
            // 将构建的主键字段放到第一位
            selectedFields = [pkField, ...selectedFields];
            console.log('添加默认主键后的 selectedFields:', selectedFields);
        }
        
        console.log('=== [handleSaveAndContinue] 主键字段处理完成 ===');
        debugger;
        
        const saveData = {
            ...formData,
            SelectedFormId: selectedForm,
            SelectedFields: selectedFields,
            PkFieldName: pkFieldName || 'FID',
            FilterCondition: filterCondition // 过滤条件
        };
        
        console.log('保存配置:', saveData);
        console.log(`已选择 ${selectedFields.length} 个字段:`, selectedFields.map(f => f.Key));
        
        try {
            // 获取飞书信息
            const baseUserId = await bitable.getUserId();
            const tenantKey = await bitable.getTenantKey();
            
            // 生成时间戳作为唯一标识
            const yn3xTableId = Date.now().toString();
            
            console.log('飞书信息:', { baseUserId, tenantKey });
            console.log('生成的 3xtableid:', yn3xTableId);
            
            // 构建文件名（包含 3xtableid）
            const fileName = `${tenantKey}_${yn3xTableId}_Para.json`;
            
            // 准备保存到后端的数据
            const backendSaveData = {
                ...saveData,
                BaseUserId: baseUserId,
                TenantKey: tenantKey,
                FileName: fileName,
                Yn3xTableId: yn3xTableId
            };
            
            console.log('准备保存到后端:', backendSaveData);
            
            // 如果启用了保存到 public 目录，调用后端接口
            if (APP_CONFIG.ENABLE_SAVE_TO_PUBLIC) {
                // 调用后端接口保存数据
                const backendUrl = API_ENDPOINTS.SAVE_CONFIG;
                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(backendSaveData)
                });
                
                const result = await response.json();
                console.log('后端保存结果:', result);
                
                if (result.code !== 0) {
                    throw new Error(result.message || '保存到后端失败');
                }
                
                console.log('后端保存成功，文件名为:', fileName);
            } else {
                console.log('已禁用保存到 public 目录，仅保存到飞书配置');
            }
            
            // 保存到飞书多维表格配置
            await bitable.saveConfigAndGoNext(backendSaveData);
            
            message.success('配置已保存');
            // 这里可以继续下一步操作，或者关闭页面
        } catch (error: any) {
            console.error('保存过程出错:', error);
            message.error(`保存失败：${error.message}`);
        }
    };

    // 字段过滤
    const handleFieldFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const keyword = e.target.value.toLowerCase();
        setFieldSearchText(keyword);
    };

    // 获取过滤后的字段列表
    const getFilteredFields = () => {
        let filtered = fields;
        
        // 先应用搜索过滤
        if (fieldSearchText) {
            filtered = filtered.filter(field => 
                field.Key.toLowerCase().includes(fieldSearchText) ||
                field.FieldName.toLowerCase().includes(fieldSearchText) ||
                field.PropertyName.toLowerCase().includes(fieldSearchText) ||
                field.Name.toLowerCase().includes(fieldSearchText) ||
                field.EntityKey.toLowerCase().includes(fieldSearchText) ||
                field.EntityName.toLowerCase().includes(fieldSearchText)
            );
        }
        
        // 再应用选中状态过滤
        if (showSelectedOnly) {
            filtered = filtered.filter(field => selectedFieldKeys.includes(field.Key));
        }
        
        return filtered;
    };

    // 列定义
    const columns = [
        {
            title: (
                <Checkbox 
                    checked={selectedFieldKeys.length === fields.length && fields.length > 0}
                    indeterminate={selectedFieldKeys.length > 0 && selectedFieldKeys.length < fields.length}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedFieldKeys(fields.map(f => f.Key));
                        } else {
                            setSelectedFieldKeys([]);
                        }
                    }}
                />
            ),
            dataIndex: 'checked',
            key: 'checked',
            width: 50,
            render: (_: any, record: MetadataField) => (
                <Checkbox
                    checked={selectedFieldKeys.includes(record.Key)}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedFieldKeys([...selectedFieldKeys, record.Key]);
                        } else {
                            setSelectedFieldKeys(selectedFieldKeys.filter(key => key !== record.Key));
                        }
                    }}
                />
            ),
        },
        {
            title: '显示名称 (Name)',
            dataIndex: 'Name',
            key: 'Name',
            width: 180,
        },
        {
            title: '字段标识 (Key)',
            dataIndex: 'Key',
            key: 'Key',
            width: 150,
        },
        {
            title: '数据类型',
            dataIndex: 'DataType',
            key: 'DataType',
            width: 100,
            render: (type: string) => {
                // DataType 已经是文本类型名称，直接显示
                return type || '文本';
            }
        },
        {
            title: '实体名称 (EntityName)',
            dataIndex: 'EntityName',
            key: 'EntityName',
            width: 150,
        },
        {
            title: '实体标识 (EntityKey)',
            dataIndex: 'EntityKey',
            key: 'EntityKey',
            width: 150,
        },
        {
            title: '字段物理名 (FieldName)',
            dataIndex: 'FieldName',
            key: 'FieldName',
            width: 150,
        },
        {
            title: '属性名 (PropertyName)',
            dataIndex: 'PropertyName',
            key: 'PropertyName',
            width: 150,
        }
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: '#ffffff',
            padding: '16px'
        }}>
            {/* 内容卡片 */}
            <div style={{
                maxWidth: '100%',
                background: '#ffffff',
                borderTop: '3px solid transparent',
                borderImage: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.15)',
                paddingBottom: '8px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <div style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                    }}>
                        <h1 style={{ 
                            fontSize: '18px', 
                            fontWeight: 600,
                            color: '#1a1a1a',
                            margin: 0
                        }}>
                            📝 选择单据
                        </h1>
                        <span style={{
                            padding: '3px 8px',
                            background: '#e6f7ff',
                            color: '#1890ff',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 500
                        }}>
                            {isCreate ? '新增' : '修改'}
                        </span>
                    </div>
                    <p style={{ 
                        fontSize: '12px', 
                        color: '#666',
                        margin: 0
                    }}>
                        配置金蝶云星空单据与字段映射
                    </p>
                </div>
                
                {/* 隐藏的配置信息表单 */}
                <Form form={form} style={{ display: 'none' }}>
                <Form.Item name="ServerUrl"><Input /></Form.Item>
                <Form.Item name="AcctID"><Input /></Form.Item>
                <Form.Item name="UserName"><Input /></Form.Item>
                <Form.Item name="AppID"><Input /></Form.Item>
                <Form.Item name="AppSec"><Input /></Form.Item>
                <Form.Item name="LCID"><Input /></Form.Item>
                <Form.Item name="OrgNum"><Input /></Form.Item>
                </Form>

                {/* 单据过滤和列表 */}
                <Collapse 
                    activeKey={formsPanelExpanded ? ['1'] : []}
                    onChange={() => setFormsPanelExpanded(!formsPanelExpanded)}
                    items={[
                    {
                        key: '1',
                        label: (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                    <span style={{ fontSize: '16px', fontWeight: 500 }}>📋 选择单据</span>
                                    {selectedForm && (
                                        <Tag color="blue">已选：{selectedForm}</Tag>
                                    )}
                                </Space>
                                <Space>
                                    <span style={{ fontSize: '14px', color: '#666' }}>语言：</span>
                                    <Select 
                                        value={languageId}
                                        onChange={(value) => {
                                            setLanguageId(value);
                                            // 如果已选择单据，重新查询以应用新语言
                                            if (selectedForm) {
                                                handleSelectForm(selectedForm);
                                            }
                                        }}
                                        style={{ width: 120 }}
                                        size="small"
                                    >
                                        <Select.Option value={2052}>简体中文</Select.Option>
                                        <Select.Option value={1033}>English</Select.Option>
                                        <Select.Option value={3076}>繁體中文</Select.Option>
                                    </Select>
                                </Space>
                            </div>
                        ),
                            children: (
                                <div>
                                    {/* 单据过滤 */}
                                    <div style={{ marginBottom: 16 }}>
                                        <Input 
                                            placeholder="搜索单据（输入表单 ID 或名称）" 
                                            onChange={handleFilterChange}
                                            allowClear
                                        />
                                    </div>

                                    {/* 自定义表单 ID 提示 */}
                                    {customFormId && filteredForms.length === 0 && (
                                        <div style={{ 
                                            marginBottom: 16, 
                                            padding: '12px', 
                                            background: '#f0f5ff', 
                                            border: '1px solid #adc6ff',
                                            borderRadius: '4px'
                                        }}>
                                            <div style={{ fontSize: '13px', color: '#1890ff', marginBottom: '8px' }}>
                                                💡 未找到匹配的单据，是否使用自定义表单 ID？
                                            </div>
                                            <Button 
                                                type="primary" 
                                                size="small"
                                                onClick={() => handleSelectForm(customFormId)}
                                            >
                                                使用 "{customFormId}" 作为表单 ID
                                            </Button>
                                        </div>
                                    )}

                                    {/* 单据列表 */}
                                    <Table
                                        rowKey="formId"
                                        columns={[
                                            {
                                                title: '表单 ID',
                                                dataIndex: 'formId',
                                                key: 'formId',
                                                width: 200,
                                            },
                                            {
                                                title: '单据名称',
                                                dataIndex: 'formName',
                                                key: 'formName',
                                            },
                                            {
                                                title: '操作',
                                                key: 'action',
                                                width: 120,
                                                render: (_: any, record: FormItem) => (
                                                    <Button
                                                        type={selectedForm === record.formId ? 'primary' : 'default'}
                                                        onClick={() => handleSelectForm(record.formId)}
                                                    >
                                                        {selectedForm === record.formId ? '已选择' : '选择'}
                                                    </Button>
                                                )
                                            }
                                        ]}
                                        dataSource={filteredForms}
                                        pagination={{ pageSize: 10 }}
                                        size="small"
                                    />
                                </div>
                            ),
                        },
                    ]}
                />

                {/* 字段列表展示 */}
                {metadataLoading && <Spin tip="查询中..." />}
            
            {!metadataLoading && fields.length > 0 && (
                <>
                    {/* 字段过滤和列表 - 可折叠 */}
                    <Collapse 
                        activeKey={fieldsPanelExpanded ? ['1'] : []}
                        onChange={() => setFieldsPanelExpanded(!fieldsPanelExpanded)}
                        items={[
                            {
                                key: '1',
                                label: (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space>
                                            <span style={{ fontSize: '16px', fontWeight: 500 }}>📝 选择字段</span>
                                            <Tag color="green">共 {fields.length} 个字段</Tag>
                                            {fieldSearchText && (
                                                <Tag color="orange">已过滤 {getFilteredFields().length} 个</Tag>
                                            )}
                                        </Space>
                                        <Space>
                                            <Checkbox
                                                checked={showSelectedOnly}
                                                onChange={(e) => {
                                                    e.stopPropagation(); // 阻止事件冒泡
                                                    setShowSelectedOnly(e.target.checked);
                                                }}
                                                onClick={(e) => e.stopPropagation()} // 阻止点击冒泡
                                            >
                                                只看已选
                                            </Checkbox>
                                            <Checkbox
                                                checked={selectedFieldKeys.length === fields.length && fields.length > 0}
                                                indeterminate={selectedFieldKeys.length > 0 && selectedFieldKeys.length < fields.length}
                                                onChange={(e) => {
                                                    e.stopPropagation(); // 阻止事件冒泡
                                                    if (e.target.checked) {
                                                        setSelectedFieldKeys(fields.map(f => f.Key));
                                                    } else {
                                                        setSelectedFieldKeys([]);
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()} // 阻止点击冒泡
                                            >
                                                全选
                                            </Checkbox>
                                        </Space>
                                    </div>
                                ),
                                children: (
                                    <div>
                                        {/* 字段过滤 */}
                                        <div style={{ marginBottom: 16 }}>
                                            <Input 
                                                placeholder="搜索字段（输入字段标识、物理名、属性名、显示名称、实体等）" 
                                                onChange={handleFieldFilterChange}
                                                allowClear
                                            />
                                        </div>

                                        {/* 字段列表 */}
                                        <Table
                                            rowKey="Key"
                                            columns={columns}
                                            dataSource={getFilteredFields()}
                                            pagination={{
                                                defaultPageSize: 20,
                                                showSizeChanger: true,
                                                pageSizeOptions: ['20', '50', '100'],
                                                showTotal: (total) => `共 ${total} 个字段${fieldSearchText ? `（已过滤 ${getFilteredFields().length} 个）` : ''}${showSelectedOnly ? '（仅显示已选）' : ''}`
                                            }}
                                            size="small"
                                            scroll={{ y: 400 }}
                                        />
                                    </div>
                                ),
                            },
                        ]}
                    />
                    
                    {/* 保存按钮放在下方 */}
                    <div style={{ marginTop: 24, marginBottom: 0, textAlign: 'right', padding: '0 8px' }}>
                        {/* 过滤条件输入框 */}
                        <div style={{ marginBottom: 12, textAlign: 'left' }}>
                            <Input 
                                placeholder="请输入过滤条件（示例：FStatus='Approved' AND FDate>2024-01-01）" 
                                value={filterCondition}
                                onChange={(e) => setFilterCondition(e.target.value)}
                                allowClear
                                size="middle"
                            />
                            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                                💡 提示：支持 SQL 语法，如 FStatus=&apos;Approved&apos;、FAmount&gt;1000、FDate&gt;&apos;2024-01-01&apos; 等
                            </div>
                        </div>
                        
                        <Space size="small">
                            {/* 编辑 JSON 按钮（不明显） */}
                            <Button 
                                type="text"
                                size="small"
                                onClick={handleOpenEditModal}
                                disabled={selectedFieldKeys.length === 0}
                                style={{ fontSize: '12px', padding: '2px 8px' }}
                            >
                                🔧 编辑
                            </Button>
                            
                            <Button 
                                type="primary" 
                                onClick={handleSaveAndContinue}
                                disabled={selectedFieldKeys.length === 0}
                                size="middle"
                                icon={<i className="anticon">💾</i>}
                            >
                                保存并同步（已选 {selectedFieldKeys.length} 个字段）
                            </Button>
                        </Space>
                    </div>
                </>
            )}
            </div>
            
            {/* 编辑 JSON 对话框 */}
            <Modal
                title="✏️ 编辑配置数据（系统维护员专用）"
                open={editModalVisible}
                onOk={handleSaveEditedJson}
                onCancel={() => setEditModalVisible(false)}
                width={800}
                okText="保存并继续"
                cancelText="取消"
            >
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '12px', color: '#999', marginBottom: 8 }}>
                        ⚠️ 警告：请谨慎修改 JSON 数据，错误的格式可能导致保存失败！
                    </div>
                    <Input.TextArea
                        value={editJsonData}
                        onChange={(e) => setEditJsonData(e.target.value)}
                        rows={20}
                        style={{ 
                            fontFamily: 'monospace',
                            fontSize: '12px'
                        }}
                    />
                </div>
            </Modal>
        </div>
    );
}
