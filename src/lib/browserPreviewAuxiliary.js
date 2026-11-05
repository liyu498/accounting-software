const CATEGORY_DEFINITIONS = [
  ["customer", "客户"],
  ["supplier", "供应商"],
  ["department", "部门"],
  ["project", "项目"],
  ["inventory", "存货"],
  ["employee", "人员"],
];

const ITEM_DEFINITIONS = {
  customer: [
    ["C001", "上海云启科技有限公司"],
    ["C002", "苏州材料供应链有限公司"],
  ],
  supplier: [
    ["S001", "北京渠道服务有限公司"],
    ["S002", "杭州设备服务有限公司"],
  ],
  department: [
    ["D001", "财务部"],
    ["D002", "销售部"],
    ["D003", "生产部"],
  ],
  project: [
    ["P001", "年度审计项目"],
    ["P002", "数字化升级项目"],
  ],
  inventory: [
    ["I001", "原材料"],
    ["I002", "产成品"],
  ],
  employee: [
    ["E001", "张三"],
    ["E002", "李四"],
  ],
};

const ACCOUNT_DEFINITIONS = {
  "1122": {
    name: "应收账款",
    categories: [
      ["customer", 1],
      ["project", 0],
    ],
  },
  "1405": {
    name: "库存商品",
    categories: [
      ["inventory", 1],
      ["project", 0],
    ],
  },
  "2202": {
    name: "应付账款",
    categories: [
      ["supplier", 1],
      ["project", 0],
    ],
  },
  "2211": {
    name: "应付职工薪酬",
    categories: [
      ["employee", 1],
      ["department", 0],
    ],
  },
  "6602": {
    name: "管理费用",
    categories: [
      ["department", 1],
      ["project", 0],
    ],
  },
};

function scopedId(companyId, kind, code) {
  return `${companyId || "browser-preview-company"}:aux-${kind}:${code}`;
}

export function browserPreviewAuxiliaryCategories(companyId) {
  return CATEGORY_DEFINITIONS.map(([code, name], index) => ({
    id: scopedId(companyId, "category", code),
    company_id: companyId,
    name,
    code,
    is_system: 1,
    sort_order: index + 1,
  }));
}

export function browserPreviewAuxiliaryItems(companyId) {
  return CATEGORY_DEFINITIONS.flatMap(([categoryCode]) =>
    ITEM_DEFINITIONS[categoryCode].map(([code, name]) => ({
      id: scopedId(companyId, "item", `${categoryCode}-${code}`),
      category_id: scopedId(companyId, "category", categoryCode),
      company_id: companyId,
      code,
      name,
      is_enabled: 1,
      remarks: null,
    })),
  );
}

export function browserPreviewAccountAuxiliarySetup(companyId, accountCode) {
  const definition = ACCOUNT_DEFINITIONS[String(accountCode || "")];
  if (!definition) return null;

  const categories = new Map(
    browserPreviewAuxiliaryCategories(companyId).map((category) => [
      category.code,
      category,
    ]),
  );

  return {
    account_code: String(accountCode),
    account_name: definition.name,
    categories: definition.categories.map(([categoryCode, isRequired]) => {
      const category = categories.get(categoryCode);
      return {
        link_id: scopedId(
          companyId,
          "link",
          `${accountCode}-${categoryCode}`,
        ),
        category_id: category.id,
        category_name: category.name,
        category_code: category.code,
        is_required: isRequired,
      };
    }),
  };
}

export function browserPreviewAccountAuxiliaryLinks(companyId, accountCode) {
  const setup = browserPreviewAccountAuxiliarySetup(companyId, accountCode);
  if (!setup) return [];
  return setup.categories.map((category) => ({
    id: category.link_id,
    account_code: setup.account_code,
    company_id: companyId,
    auxiliary_category_id: category.category_id,
    is_required: category.is_required,
  }));
}

export function browserPreviewAccountHasAuxiliary(accountCode) {
  return Object.prototype.hasOwnProperty.call(
    ACCOUNT_DEFINITIONS,
    String(accountCode || ""),
  );
}
