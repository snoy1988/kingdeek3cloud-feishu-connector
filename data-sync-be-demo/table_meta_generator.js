/**
 * 根据配置生成飞书多维表格表结构
 * @param {Object} datasourceConfig - 数据源配置对象
 * @param {Array} datasourceConfig.SelectedFields - 选中的字段列表
 * @param {string} datasourceConfig.SelectedFormId - 选中的表单 ID
 * @returns {Object} 表结构对象
 */
function generateTableMeta(datasourceConfig) {
    const { SelectedFields = [] } = datasourceConfig;

    // 构建字段列表
    const fields = SelectedFields.map((field, index) => {

        let isPrimary=false;
        // 第一个字段设为主键
        if(index === 0){
            isPrimary=true;
        }
        
        return {
            fieldId: field.Key, // 直接使用 SelectedFields 中的 Key
            fieldName: field.Name || field.FieldName || field.Key,
            fieldType: field.FieldType,
            isPrimary: isPrimary, // 第一个字段设为主键
            description: `${field.EntityName} - ${field.PropertyName || ''}`,
            property: field.Property
        };
    });
    
    return {
        tableName: `金蝶数据-${datasourceConfig.SelectedFormId || 'Unknown'}`,
        fields: fields
    };
}

module.exports = { generateTableMeta };
