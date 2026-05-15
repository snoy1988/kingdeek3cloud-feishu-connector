// 应用配置
export const APP_CONFIG = {
    // 后端 API 地址
    BACKEND_API_URL: 'https://project.ynkingdee.com:9595',
    
    // 金蝶云星空默认服务器地址
    KINGDEE_DEFAULT_SERVER_URL: 'https://my.kingdee.com',
    
    // 默认语言 ID (2052=简体中文，1033=英文，3076=繁体中文)
    DEFAULT_LANGUAGE_ID: 2052,
    
    // 表格分页配置
    TABLE_PAGE_SIZE: 20,
    TABLE_PAGE_SIZE_OPTIONS: ['20', '50', '100'],
    
    // 字段选择配置
    FIELD_TABLE_SCROLL_HEIGHT: 400,
    
    // 是否保存配置文件到后端 public 目录（开发模式：true，生产模式：false）
    ENABLE_SAVE_TO_PUBLIC: false,
};

// API 端点配置
export const API_ENDPOINTS = {
    // 查询元数据接口
    QUERY_METADATA: `${APP_CONFIG.BACKEND_API_URL}/api/query-metadata`,
    
    // 金蝶登录接口
    LOGIN_KINGDEE: `${APP_CONFIG.BACKEND_API_URL}/api/login`,
    
    // 保存配置接口
    SAVE_CONFIG: `${APP_CONFIG.BACKEND_API_URL}/api/save-config`,
};
