import {
  FileCheck2,
  FileText,
  LayoutTemplate,
  Printer,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { fixedPrintTemplatePreviews } from "./businessModuleRegistry";

type PrintTemplate = (typeof fixedPrintTemplatePreviews)[number];

function moduleForTemplate(template: PrintTemplate) {
  if (template.name === "记账凭证") return "会计凭证";
  if (template.name === "账簿与余额表") return "账簿与余额表";
  if (template.name === "财务报表") return "财务报表";
  if (template.name === "税务申报包") return "税务申报";
  return "业务清单";
}

function paperParts(template: PrintTemplate) {
  const [paper, orientation] = template.paper.split(" ");
  return { paper, orientation: orientation || "未标注" };
}

export function PrintTemplateWorkspace() {
  const navigate = useNavigate();
  const [selectedName, setSelectedName] = useState(
    fixedPrintTemplatePreviews[0]?.name || "",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const selectedTemplate =
    fixedPrintTemplatePreviews.find(
      (template) => template.name === selectedName,
    ) || fixedPrintTemplatePreviews[0];
  const metrics = useMemo(() => {
    const orientations = new Set(
      fixedPrintTemplatePreviews.map(
        (template) => paperParts(template).orientation,
      ),
    );
    const modules = new Set(fixedPrintTemplatePreviews.map(moduleForTemplate));
    return {
      total: fixedPrintTemplatePreviews.length,
      orientations: orientations.size,
      modules: modules.size,
    };
  }, []);
  const templatePage = useMemo(
    () => paginateOperationalRows(fixedPrintTemplatePreviews, page, pageSize),
    [page, pageSize],
  );
  const exportHeaders = [
    "模板名称",
    "适用模块",
    "纸张",
    "方向",
    "版本",
    "版式范围",
    "分页规则",
    "发布方式",
  ];
  const exportRows = useMemo(
    () =>
      fixedPrintTemplatePreviews.map((template) => {
        const paper = paperParts(template);
        return [
          template.name,
          moduleForTemplate(template),
          paper.paper,
          paper.orientation,
          template.version,
          template.layout,
          template.pagination,
          "版本受控",
        ];
      }),
    [],
  );

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        className="min-w-0 border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
        data-operational-export-root
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">打印模板</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              核对内置凭证、账簿、报表、申报包和业务清单的纸张、版式与分页规则。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="打印模板清单"
              exportHeaders={exportHeaders}
              exportRows={exportRows}
            />
            <div className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <Printer className="h-3.5 w-3.5" />
              固定输出版本
            </div>
          </div>
        </header>

        <section className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              输出边界
            </div>
            <p className="mt-1">
              固定输出模板随应用版本受控发布，不能在此页伪造可编辑的版式配置。字段或版式调整应在对应导出代码中完成，并重新验证输出结果。
            </p>
          </div>
          <div className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">
              审阅范围
            </p>
            <p className="mt-1">
              本页展示模板定义与分页规则。正式输出仍以当前账套、账期、筛选范围及审核状态为准。
            </p>
          </div>
        </section>

        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={LayoutTemplate}
            label="内置模板"
            value={`${metrics.total} 套`}
          />
          <Metric
            icon={Printer}
            label="适用模块"
            value={`${metrics.modules} 类`}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={FileText}
            label="输出方向"
            value={`${metrics.orientations} 种`}
          />
          <Metric
            icon={FileCheck2}
            label="发布方式"
            value="版本受控"
            tone="text-emerald-600 dark:text-emerald-400"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>模板清单</span>
          <span>显示 {fixedPrintTemplatePreviews.length} 套内置模板</span>
        </div>

        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
              <tr>
                <th className="w-[14%] px-4 py-3 font-medium">模板名称</th>
                <th className="w-[12%] px-4 py-3 font-medium">适用模块</th>
                <th className="w-[11%] px-4 py-3 font-medium">纸张与方向</th>
                <th className="w-[9%] px-4 py-3 font-medium">版本</th>
                <th className="w-[26%] px-4 py-3 font-medium">版式范围</th>
                <th className="w-[21%] px-4 py-3 font-medium">分页规则</th>
                <th className="w-[7%] px-4 py-3 text-right font-medium">
                  审阅
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {templatePage.rows.map((template) => {
                const paper = paperParts(template);
                const selected = template.name === selectedTemplate?.name;
                return (
                  <tr
                    key={template.name}
                    className={
                      selected
                        ? "bg-sky-50/70 dark:bg-sky-950/20"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }
                  >
                    <td className="px-4 py-3">
                      <p className="truncate font-medium" title={template.name}>
                        {template.name}
                      </p>
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                        内置模板
                      </p>
                    </td>
                    <td
                      className="truncate px-4 py-3"
                      title={moduleForTemplate(template)}
                    >
                      {moduleForTemplate(template)}
                    </td>
                    <td className="px-4 py-3">
                      <p>{paper.paper}</p>
                      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                        {paper.orientation}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono">{template.version}</td>
                    <td className="px-4 py-3">
                      <p className="truncate" title={template.layout}>
                        {template.layout}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate" title={template.pagination}>
                        {template.pagination}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedName(template.name)}
                        className="inline-flex h-8 items-center justify-center border border-slate-300 px-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        查看
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 p-3 lg:hidden">
          {templatePage.rows.map((template) => {
            const paper = paperParts(template);
            const selected = template.name === selectedTemplate?.name;
            return (
              <article
                key={template.name}
                className={
                  selected
                    ? "border border-sky-400 bg-sky-50/70 p-3 dark:border-sky-700 dark:bg-sky-950/20"
                    : "border border-slate-200 p-3 dark:border-slate-800"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      title={template.name}
                    >
                      {template.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {moduleForTemplate(template)} · {template.version}
                    </p>
                  </div>
                  <span className="shrink-0 border border-slate-300 px-2 py-0.5 text-xs dark:border-slate-700">
                    {paper.paper} {paper.orientation}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Info label="版式范围" value={template.layout} />
                  <Info label="分页规则" value={template.pagination} />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedName(template.name)}
                  className="mt-3 inline-flex h-8 items-center justify-center border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  查看版式
                </button>
              </article>
            );
          })}
        </div>

        <OperationalPagination
          page={templatePage}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />

        {selectedTemplate && (
          <section className="border-t border-slate-200 p-3 dark:border-slate-800">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="border border-slate-200 p-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
                  <h2 className="text-sm font-semibold">
                    {selectedTemplate.name}
                  </h2>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {selectedTemplate.layout}
                </p>
              </div>
              <div className="border border-slate-200 p-3 text-xs leading-5 dark:border-slate-800">
                <p className="font-medium">分页规则</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {selectedTemplate.pagination}
                </p>
              </div>
            </div>
          </section>
        )}
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <QuickLink
          icon={FileText}
          title="会计凭证"
          description="核对凭证纸输出范围。"
          onClick={() => navigate("/vouchers")}
        />
        <QuickLink
          icon={FileCheck2}
          title="财务报表"
          description="复核报表项目和金额列输出。"
          onClick={() => navigate("/reports")}
        />
        <QuickLink
          icon={ShieldCheck}
          title="税务申报"
          description="查看申报包的取数与校验流程。"
          onClick={() => navigate("/tax/workspace")}
        />
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900 dark:text-slate-100",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-slate-800 dark:text-slate-100">
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-200 bg-white p-4 text-left hover:border-sky-300 hover:bg-sky-50 dark:border-slate-800 dark:bg-[#111827] dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
    >
      <Icon className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </button>
  );
}
