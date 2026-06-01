const getTableMeta = () => {
  return {
    tableName: "测试连接器插件",
    fields: [
      {
        fieldId: "fid_1",
        fieldName: "id1",
        fieldType: 1,
        isPrimary: true,
        description: "",
      },
      {
        fieldId: "fid_2",
        fieldName: "数字",
        fieldType: 2,
        isPrimary: false,
        property: {
          formatter: "#,##0.00",
        },
      },
      {
        fieldId: "fid_3",
        fieldName: "单选",
        fieldType: 3,
        isPrimary: false,
        description: "xxx",
        property: {},
      },
      {
        fieldId: "fid_4",
        fieldName: "多选",
        fieldType: 4,
        isPrimary: false,
        description: "xxx",
        property: {},
      },
      {
        fieldId: "fid_5",
        fieldName: "日期",
        fieldType: 5,
        isPrimary: false,
        description: "xxx",
        property: {
          formatter: "dd/MM/yyyy",
        },
      },
      {
        fieldId: "fid_6",
        fieldName: "条形码",
        fieldType: 6,
        isPrimary: false,
        description: "xxx",
        property: {},
      },
      {
        fieldId: "fid_7",
        fieldName: "复选框",
        fieldType: 7,
        isPrimary: false,
        description: "xxx",
        property: {},
      },
      {
        fieldId: "fid_8",
        fieldName: "货币",
        fieldType: 8,
        isPrimary: false,
        description: "xxx",
        property: {
          formatter: "#,##0.000",
          currencyCode: "USD",
        },
      },
      {
        fieldId: "fid_9",
        fieldName: "电话",
        fieldType: 9,
        isPrimary: false,
        description: "xxx",
        property: {},
      },
      {
        fieldId: "fid_10",
        fieldName: "url",
        fieldType: 10,
        isPrimary: false,
        description: "xxx",
        property: {},
      },
      {
        fieldId: "fid_11",
        fieldName: "进度",
        fieldType: 11,
        isPrimary: false,
        description: "xxx",
        property: {
          formatter: "0.0%",
          min: 10,
          max: 1000,
          color: 4,
        },
      },
      {
        fieldId: "fid_12",
        fieldName: "评分",
        fieldType: 12,
        isPrimary: false,
        description: "xxx",
        property: {
          min: 1,
          max: 10,
          symbol: "smile",
        },
      },
      {
        fieldId: "fid_13",
        fieldName: "地理位置",
        fieldType: 13,
        isPrimary: false,
        description: "xxx",
      },
      {
        fieldId: "fid_14",
        fieldName: "人员",
        fieldType: 14,
        isPrimary: false,
        description: "xxx",
      },
      {
        fieldId: "fid_15",
        fieldName: "附件",
        fieldType: 15,
        isPrimary: false,
        description: "xxx",
      },
      {
        fieldId: "fid_16",
        fieldName: "群组",
        fieldType: 16,
        isPrimary: false,
        description: "xxx",
      }
    ],
  };
};

module.exports = { getTableMeta };
