import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.tsx$/.test(entry.name)
        ? [file]
        : [];
  });
}

test("account archive uses selection controls for finite filter dimensions", () => {
  const source = read("src/pages/Welcome.tsx");

  for (const label of [
    "地区",
    "企业类型",
    "纳税人资格",
    "采集状态",
    "主办会计",
    "账期",
  ]) {
    assert.match(source, new RegExp(`<FilterSelect\\s+label=["']${label}["']`));
    assert.doesNotMatch(source, new RegExp(`<FilterField\\s+label=["']${label}["']`));
  }

  for (const label of ["企业名称", "企业编码", "纳税人识别号"]) {
    assert.match(source, new RegExp(`<FilterField\\s+label=["']${label}["']`));
  }
  assert.doesNotMatch(source, /placeholder=\{placeholder \|\| ['"]全部['"]\}/);
});

test("data-derived selection options are normalized and preserve an active value", async () => {
  const helper = join(root, "src/lib/filterOptions.js");
  assert.equal(existsSync(helper), true, "expected shared filter option helper");

  const { buildFilterValues } = await import(pathToFileURL(helper));
  assert.deepEqual(
    buildFilterValues([" 小规模纳税人 ", "一般纳税人", "小规模纳税人", ""], "历史类型"),
    ["历史类型", "小规模纳税人", "一般纳税人"],
  );
});

test("finite filter state is not rendered as a free-text input", () => {
  const violations = sourceFiles(join(root, "src"))
    .flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/<input\b[^>]*\bvalue=\{([A-Za-z_$][\w$]*(?:Status|Type|Scope|Category|Risk|Module)Filter)\}[^>]*>/g)]
        .map((match) => `${file.slice(root.length + 1)}:${source.slice(0, match.index).split("\n").length}:${match[1]}`);
    });

  assert.deepEqual(violations, []);
});
