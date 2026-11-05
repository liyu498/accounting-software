import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

async function loadReferenceData() {
  const helper = join(root, "src/lib/companyReferenceData.js");
  assert.equal(existsSync(helper), true, "expected shared company reference data");
  return import(pathToFileURL(helper));
}

test("company region data covers all province-level regions and county-level divisions", async () => {
  const {
    chinaProvinceOptions,
    chinaRegionStats,
    getChinaCityOptions,
    getChinaDistrictOptions,
    isValidChinaRegion,
  } = await loadReferenceData();

  assert.equal(chinaProvinceOptions.length, 34);
  for (const province of [
    "北京市",
    "江苏省",
    "西藏自治区",
    "台湾省",
    "香港特别行政区",
    "澳门特别行政区",
  ]) {
    assert.equal(chinaProvinceOptions.includes(province), true, `missing ${province}`);
  }
  assert.equal(chinaRegionStats.cityCount >= 300, true);
  assert.equal(chinaRegionStats.districtCount >= 2800, true);

  const jiangsuCities = getChinaCityOptions("江苏省");
  assert.equal(jiangsuCities.includes("南京市"), true);
  assert.equal(jiangsuCities.includes("苏州市"), true);
  assert.equal(jiangsuCities.length >= 13, true);

  const nanjingDistricts = getChinaDistrictOptions("江苏省", "南京市");
  assert.equal(nanjingDistricts.includes("玄武区"), true);
  assert.equal(nanjingDistricts.includes("江宁区"), true);
  assert.equal(nanjingDistricts.length >= 11, true);

  assert.deepEqual(getChinaCityOptions("上海市"), ["上海市"]);
  assert.equal(getChinaDistrictOptions("上海市", "上海市").includes("浦东新区"), true);
  assert.deepEqual(getChinaCityOptions("香港特别行政区"), ["香港特别行政区"]);
  assert.equal(getChinaDistrictOptions("香港特别行政区", "香港特别行政区").includes("中西区"), true);

  assert.equal(isValidChinaRegion({ province: "江苏省", city: "南京市", district: "玄武区" }), true);
  assert.equal(isValidChinaRegion({ province: "上海市", city: "上海市", district: "浦东新区" }), true);
  assert.equal(isValidChinaRegion({ province: "台湾省", city: "台湾省", district: "" }), true);
  assert.equal(isValidChinaRegion({ province: "江苏省", city: "深圳市", district: "南山区" }), false);
  assert.equal(isValidChinaRegion({ province: "江苏省", city: "南京市", district: "南山区" }), false);
});

test("region changes replace stale city and district values", async () => {
  const { changeChinaRegionProvince, changeChinaRegionCity } = await loadReferenceData();

  assert.deepEqual(
    changeChinaRegionProvince(
      { province: "广东省", city: "深圳市", district: "南山区" },
      "江苏省",
    ),
    { province: "江苏省", city: "南京市", district: "玄武区" },
  );
  assert.deepEqual(
    changeChinaRegionCity(
      { province: "江苏省", city: "南京市", district: "玄武区" },
      "苏州市",
    ),
    { province: "江苏省", city: "苏州市", district: "虎丘区" },
  );
});

test("company reference selections are comprehensive and shared by both editors", async () => {
  const {
    buildEnableYearOptions,
    enterpriseTypeOptions,
    industryOptions,
    isValidEnableYear,
  } = await loadReferenceData();

  assert.equal(industryOptions.length >= 20, true);
  assert.equal(industryOptions.includes("农、林、牧、渔业"), true);
  assert.equal(industryOptions.includes("信息传输、软件和信息技术服务业"), true);
  assert.equal(enterpriseTypeOptions.length, 23);
  assert.equal(enterpriseTypeOptions.includes("国有独资公司"), true);
  assert.equal(enterpriseTypeOptions.includes("股份合作企业"), true);
  assert.equal(enterpriseTypeOptions.includes("港澳台投资合伙企业"), true);
  assert.equal(enterpriseTypeOptions.includes("外商投资股份有限公司"), true);
  assert.equal(enterpriseTypeOptions.includes("个体工商户"), true);
  assert.equal(enterpriseTypeOptions.includes("农民专业合作社（联合社）"), true);
  assert.equal(enterpriseTypeOptions.includes("其他市场主体"), true);

  const years = buildEnableYearOptions(2026, "1998");
  assert.equal(years.includes("1998"), true);
  assert.equal(years.includes("1900"), true);
  assert.equal(years.includes("2027"), true);
  assert.equal(years.includes("2028"), false);
  assert.equal(years.length, 128);
  assert.equal(buildEnableYearOptions(2026, "1899").includes("1899"), false);
  assert.equal(buildEnableYearOptions(2026, "2028").includes("2028"), false);
  assert.equal(isValidEnableYear("1900", 2026), true);
  assert.equal(isValidEnableYear("2027", 2026), true);
  assert.equal(isValidEnableYear("1899", 2026), false);
  assert.equal(isValidEnableYear("2028", 2026), false);

  const welcome = read("src/pages/Welcome.tsx");
  const companyInfo = read("src/pages/operations/CompanyInfoWorkspace.tsx");
  for (const source of [welcome, companyInfo]) {
    assert.match(source, /<ChinaRegionSelect\b/);
    assert.match(source, /industryOptions/);
    assert.match(source, /enterpriseTypeOptions/);
  }
  assert.doesNotMatch(welcome, /options=\{\['江苏省', '上海市', '浙江省', '广东省'\]\}/);
  assert.match(companyInfo, /Object\.entries\(accountingSystemLabels\)/);
  assert.match(companyInfo, /isValidEnableYear\(enableYear/);
});
