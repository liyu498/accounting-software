// Shared constants for the accounting app

export type TaxpayerType = 'small' | 'general'
export type CustomerStatus = 'active' | 'inactive' | 'suspended'
export type AccountingSystem = 'small_enterprise' | 'enterprise' | 'non_profit' | 'cooperative'

export const taxpayerTypeLabels: Record<TaxpayerType, string> = {
  small: '小规模纳税人',
  general: '一般纳税人',
}

export const accountingSystemLabels: Record<AccountingSystem, string> = {
  small_enterprise: '小企业会计准则',
  enterprise: '企业会计准则',
  non_profit: '民间非营利组织会计制度',
  cooperative: '农民专业合作社财务会计制度',
}

export const accountingSystemDescriptions: Record<AccountingSystem, string> = {
  small_enterprise: '适用于小型企业，科目简化',
  enterprise: '适用于大中型企业，科目完整',
  non_profit: '适用于民间非营利组织（社会团体、基金会等）',
  cooperative: '适用于农民专业合作社',
}

export const accountingStandardLabels: Record<string, string> = {
  small: '小企业会计准则',
  enterprise: '企业会计准则',
  small_enterprise: '小企业会计准则',
  non_profit: '民间非营利组织会计制度',
  cooperative: '农民专业合作社财务会计制度',
}

export const statusLabels: Record<CustomerStatus, string> = {
  active: '正常',
  inactive: '停用',
  suspended: '暂停',
}

export const accountStatusLabels: Record<string, string> = {
  active: '正常',
  closed: '已关账',
  suspended: '暂停',
}

export const provinces = [
  '北京市', '上海市', '天津市', '重庆市',
  '广东省', '浙江省', '江苏省', '山东省',
  '四川省', '湖北省', '湖南省', '河南省',
  '河北省', '福建省', '安徽省', '辽宁省',
  '陕西省', '江西省', '云南省', '广西壮族自治区',
  '山西省', '吉林省', '黑龙江省', '贵州省',
  '甘肃省', '内蒙古自治区', '新疆维吾尔自治区',
  '宁夏回族自治区', '西藏自治区', '海南省', '青海省',
]

export const citiesByProvince: Record<string, string[]> = {
  '北京市': ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区', '通州区', '顺义区', '大兴区', '昌平区'],
  '上海市': ['浦东新区', '黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '闵行区', '宝山区', '嘉定区', '松江区'],
  '广东省': ['广州市', '深圳市', '珠海市', '汕头市', '佛山市', '韶关市', '湛江市', '肇庆市', '江门市', '茂名市', '惠州市', '梅州市'],
  '浙江省': ['杭州市', '宁波市', '温州市', '嘉兴市', '湖州市', '绍兴市', '金华市', '衢州市', '舟山市', '台州市', '丽水市'],
  '江苏省': ['南京市', '无锡市', '徐州市', '常州市', '苏州市', '南通市', '连云港市', '淮安市', '盐城市', '扬州市', '镇江市'],
  '天津市': ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '滨海新区'],
  '重庆市': ['渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区', '北碚区', '渝北区', '巴南区', '万州区', '涪陵区'],
}

export const accountTypeLabels: Record<string, string> = {
  asset: '资产类',
  liability: '负债类',
  equity: '所有者权益类',
  cost: '成本类',
  income: '损益类-收入',
  expense: '损益类-费用',
}

export const balanceDirectionLabels: Record<string, string> = {
  debit: '借方',
  credit: '贷方',
}
