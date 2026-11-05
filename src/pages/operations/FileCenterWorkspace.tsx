import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileClock,
  FileSearch,
  FileUp,
  Link2,
  Paperclip,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import { cn } from "../../lib/utils";
import {
  loadBrowserPreviewOpenPeriod,
  previewPeriodLabel,
} from "../../lib/browserPreviewPeriod";
import {
  formatLocalFileSize,
  recordLocalAttachment,
  recordLocalImportJob,
  removeLocalAttachment,
  removeLocalImportJob,
  updateLocalAttachmentAssociation,
  updateLocalImportJobValidation,
  useLocalAttachmentRecords,
  useLocalImportJobs,
  type LocalAttachmentRecord,
  type LocalFileStatus,
  type LocalImportJob,
} from "../../lib/localFileRegistry";
import {
  recordAuditLog,
  useAuditLogs,
  useExportJobs,
  type ExportJob,
} from "../../lib/exportJobs";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";
import { useCompanyStore } from "../../stores/companyStore";
import { usePeriodStore } from "../../stores/periodStore";

type FileScope = { companyId: string; period: string };

const sourceModules = [
  "发票采集",
  "银行流水",
  "原始单据",
  "会计凭证",
  "税务申报",
  "其他资料",
];

function useFileScope() {
  const selectedCompanyId = useCompanyStore((state) => state.selectedCompanyId);
  const selectedCompany = useCompanyStore((state) =>
    state.companies.find((company) => company.id === state.selectedCompanyId),
  );
  const periods = usePeriodStore((state) => state.periods);
  const currentPeriodId = usePeriodStore((state) => state.currentPeriodId);
  const fetchPeriods = usePeriodStore((state) => state.fetchPeriods);
  const currentPeriod = periods.find((item) => item.id === currentPeriodId);
  const browserPeriod = isTauri
    ? undefined
    : loadBrowserPreviewOpenPeriod(selectedCompanyId);
  const companyId =
    selectedCompanyId || (isTauri ? "" : "browser-preview-company");
  const period =
    previewPeriodLabel(currentPeriod) ||
    previewPeriodLabel(browserPeriod) ||
    "";

  useEffect(() => {
    if (isTauri && selectedCompanyId) void fetchPeriods(selectedCompanyId);
  }, [fetchPeriods, selectedCompanyId]);

  return {
    scope: {
      companyId: companyId || "未选择账套",
      period: period || "未选择账期",
    } satisfies FileScope,
    ready: Boolean(companyId && period),
    period,
    companyName: selectedCompany?.name,
  };
}

function statusClass(status: LocalFileStatus | ExportJob["status"]) {
  if (status === "已关联" || status === "已写入" || status === "已完成")
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "已校验" || status === "待确认")
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300";
  return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300";
}

function StatusPill({
  status,
}: {
  status: LocalFileStatus | ExportJob["status"];
}) {
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-0.5 text-xs",
        statusClass(status),
      )}
    >
      {status}
    </span>
  );
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const color =
    tone === "green"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "slate"
          ? "text-slate-700 dark:text-slate-200"
          : "text-[#1f65a7] dark:text-sky-300";
  return (
    <div className="border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-[#111827]">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", color)}>
        {value}
      </div>
    </div>
  );
}

function WorkspaceHeader({
  icon,
  title,
  description,
  period,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  period: string;
  actions: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          当前范围：{period || "请先在顶部选择账套和账期"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </header>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed border-slate-300 px-4 py-12 text-center dark:border-slate-700">
      <FileSearch className="mx-auto h-5 w-5 text-slate-400" />
      <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
      </div>
      <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

function AttachmentRowActions({
  record,
  onAssociate,
  onRemove,
}: {
  record: LocalAttachmentRecord;
  onAssociate: (record: LocalAttachmentRecord) => void;
  onRemove: (record: LocalAttachmentRecord) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={() => onAssociate(record)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <Link2 className="h-3.5 w-3.5" />
        关联单据
      </button>
      <button
        type="button"
        onClick={() => onRemove(record)}
        className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
        移除登记
      </button>
    </div>
  );
}

export function AttachmentCenterWorkspace() {
  const { scope, ready, period, companyName } = useFileScope();
  const records = useLocalAttachmentRecords(scope);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const [sourceModule, setSourceModule] = useState("全部来源");
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [association, setAssociation] = useState<{
    id: string;
    fileName: string;
    relatedDocument: string;
  } | null>(null);

  const filteredRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return records.filter((record) => {
      const matchesSource =
        sourceModule === "全部来源" || record.sourceModule === sourceModule;
      const haystack = [
        record.fileName,
        record.fileFormat,
        record.sourceModule,
        record.relatedDocument,
        record.operator,
        record.checksum,
      ]
        .join(" ")
        .toLowerCase();
      return matchesSource && (!normalized || haystack.includes(normalized));
    });
  }, [keyword, records, sourceModule]);
  const attachmentPage = useMemo(
    () => paginateOperationalRows(filteredRecords, page, pageSize),
    [filteredRecords, page, pageSize],
  );
  const exportHeaders = [
    "附件名称",
    "格式",
    "大小",
    "来源模块",
    "关联单据",
    "校验值",
    "登记人",
    "登记时间",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredRecords.map((record) => [
        record.fileName,
        record.fileFormat,
        formatLocalFileSize(record.fileSize),
        record.sourceModule,
        record.relatedDocument,
        record.checksum,
        record.operator,
        record.createdAt,
        record.status,
      ]),
    [filteredRecords],
  );

  const metrics = useMemo(
    () => ({
      linked: records.filter((record) => record.status === "已关联").length,
      pending: records.filter((record) => record.status === "待确认").length,
      formats: new Set(records.map((record) => record.fileFormat)).size,
    }),
    [records],
  );

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (!ready) {
      setNotice("请先在顶部选择账套和账期，再登记本机附件。");
      return;
    }
    try {
      const created = await Promise.all(
        files.map((file) =>
          recordLocalAttachment({
            ...scope,
            sourceModule:
              sourceModule === "全部来源" ? "其他资料" : sourceModule,
            file,
          }),
        ),
      );
      const completed = created.filter(Boolean).length;
      files.forEach((file) =>
        recordAuditLog({
          module: "附件中心",
          action: "登记本机附件",
          object: file.name,
          level: "中",
          result: "待审批",
          status: "待确认",
          attachment: file.name,
        }),
      );
      setNotice(
        `已登记 ${completed} 个本机附件元数据并计算校验值。文件未上传至外部存储，仍需人工关联到单据。`,
      );
    } catch (error) {
      setNotice(`登记附件失败：${String(error)}`);
    }
  };

  const handleAssociate = (record: LocalAttachmentRecord) => {
    setAssociation({
      id: record.id,
      fileName: record.fileName,
      relatedDocument:
        record.relatedDocument === "待关联单据" ? "" : record.relatedDocument,
    });
    setNotice(null);
  };

  const saveAssociation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!association) return;
    try {
      const updated = await updateLocalAttachmentAssociation(
        association.id,
        association.relatedDocument,
        scope.companyId,
      );
      if (!updated) {
        setNotice("关联单据编号不能为空，或该附件登记已不存在。");
        return;
      }
      recordAuditLog({
        module: "附件中心",
        action: "关联单据",
        object: `${association.fileName} -> ${updated.relatedDocument}`,
        attachment: association.fileName,
      });
      setAssociation(null);
      setNotice("附件已关联到指定单据；关联动作已写入本地审计日志。");
    } catch (error) {
      setNotice(`关联附件失败：${String(error)}`);
    }
  };

  const removeAttachment = async (record: LocalAttachmentRecord) => {
    try {
      if (!await removeLocalAttachment(record.id, scope.companyId)) {
        setNotice("未找到该附件登记，无法移除。");
        return;
      }
      recordAuditLog({
        module: "附件中心",
        action: "移除附件登记",
        object: record.fileName,
        level: "中",
        result: "待审批",
        status: "待确认",
        attachment: record.fileName,
      });
      setNotice("已移除本机附件登记，不会删除任何外部存储文件。");
    } catch (error) {
      setNotice(`移除附件登记失败：${String(error)}`);
    }
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <WorkspaceHeader
          icon={
            <Paperclip className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
          }
          title="附件中心"
          description="登记本机附件校验值、来源和关联单据；附件文件不会被静默上传或替换。"
          period={period}
          actions={
            <>
              <OperationalExportActions
                title="附件登记清单"
                companyName={companyName}
                periodLabel={period}
                exportHeaders={exportHeaders}
                exportRows={exportRows}
                onNotice={setNotice}
              />
              <button
                type="button"
                onClick={() => setNotice("附件列表已按当前账套与账期刷新。")}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
              >
                <Upload className="h-3.5 w-3.5" />
                登记附件
              </button>
            </>
          }
        />
        <input
          ref={uploadRef}
          onChange={(event) => void handleUpload(event)}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.ofd,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.zip"
        />
        {notice && <Notice>{notice}</Notice>}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-4">
          <Metric label="附件登记" value={`${records.length} 个`} />
          <Metric label="已关联" value={`${metrics.linked} 个`} tone="green" />
          <Metric label="待关联" value={`${metrics.pending} 个`} tone="amber" />
          <Metric
            label="文件格式"
            value={`${metrics.formats} 种`}
            tone="slate"
          />
        </div>
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row">
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索附件名称、关联单据、校验值"
            className="h-8 w-full border border-slate-300 bg-white px-3 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f] lg:max-w-md"
          />
          <select
            aria-label="附件来源"
            value={sourceModule}
            onChange={(event) => {
              setSourceModule(event.target.value);
              setPage(1);
            }}
            className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
          >
            <option>全部来源</option>
            {sourceModules.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        {association && (
          <form
            onSubmit={saveAssociation}
            className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0d0d0d] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
          >
            <div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                关联附件
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {association.fileName}
              </div>
            </div>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              单据编号或业务标识
              <input
                autoFocus
                value={association.relatedDocument}
                onChange={(event) =>
                  setAssociation({
                    ...association,
                    relatedDocument: event.target.value,
                  })
                }
                placeholder="例如：DOC-2026-0001"
                className="mt-1 h-8 w-full border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAssociation(null)}
                className="h-8 border border-slate-300 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button className="h-8 bg-[#1f65a7] px-3 text-xs font-medium text-white">
                确认关联
              </button>
            </div>
          </form>
        )}
        <div className="hidden p-3 lg:block">
          {filteredRecords.length === 0 ? (
            <EmptyState
              title="当前范围没有附件登记"
              description="登记附件后会保存名称、格式、大小、校验值和关联状态；实际文件仍保留在本机原位置。"
            />
          ) : (
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-[#202020] dark:text-slate-300">
                <tr>
                  <th className="w-[25%] px-3 py-2 font-medium">附件</th>
                  <th className="w-[13%] px-3 py-2 font-medium">来源</th>
                  <th className="w-[19%] px-3 py-2 font-medium">关联单据</th>
                  <th className="w-[17%] px-3 py-2 font-medium">校验与登记</th>
                  <th className="w-[11%] px-3 py-2 font-medium">状态</th>
                  <th className="w-[15%] px-3 py-2 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {attachmentPage.rows.map((record) => (
                  <tr
                    key={record.id}
                    className="border-t border-slate-100 align-top dark:border-slate-800"
                  >
                    <td className="break-words px-3 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {record.fileName}
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">
                        {record.fileFormat} ·{" "}
                        {formatLocalFileSize(record.fileSize)}
                      </div>
                    </td>
                    <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
                      {record.sourceModule}
                    </td>
                    <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
                      {record.relatedDocument}
                    </td>
                    <td className="break-all px-3 py-3 text-slate-500 dark:text-slate-400">
                      <div>{record.checksum.slice(0, 16)}...</div>
                      <div className="mt-1">{record.createdAt}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={record.status} />
                    </td>
                    <td className="px-3 py-3">
                      <AttachmentRowActions
                        record={record}
                        onAssociate={handleAssociate}
                        onRemove={removeAttachment}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="space-y-2 p-3 lg:hidden">
          {filteredRecords.length === 0 ? (
            <EmptyState
              title="当前范围没有附件登记"
              description="请先登记本机文件。"
            />
          ) : (
            attachmentPage.rows.map((record) => (
              <article
                key={record.id}
                className="border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium">
                      {record.fileName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {record.fileFormat} ·{" "}
                      {formatLocalFileSize(record.fileSize)} ·{" "}
                      {record.sourceModule}
                    </div>
                  </div>
                  <StatusPill status={record.status} />
                </div>
                <div className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">
                  关联：{record.relatedDocument}
                </div>
                <div className="mt-3">
                  <AttachmentRowActions
                    record={record}
                    onAssociate={handleAssociate}
                    onRemove={removeAttachment}
                  />
                </div>
              </article>
            ))
          )}
        </div>
        <OperationalPagination
          page={attachmentPage}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </main>
  );
}

function ImportRowActions({
  job,
  onValidate,
  onRemove,
}: {
  job: LocalImportJob;
  onValidate: (job: LocalImportJob) => void;
  onRemove: (job: LocalImportJob) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        disabled={job.status !== "待确认"}
        onClick={() => onValidate(job)}
        className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
      >
        <FileCheck2 className="h-3.5 w-3.5" />
        人工校验
      </button>
      <button
        type="button"
        onClick={() => onRemove(job)}
        className="inline-flex h-7 items-center gap-1 border border-rose-300 px-2 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
        移除批次
      </button>
    </div>
  );
}

export function ImportHistoryWorkspace() {
  const { scope, ready, period, companyName } = useFileScope();
  const jobs = useLocalImportJobs(scope);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [moduleName, setModuleName] = useState("发票采集");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("全部状态");
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filteredJobs = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesStatus = status === "全部状态" || job.status === status;
      const haystack = [
        job.fileName,
        job.moduleName,
        job.operation,
        job.fileFormat,
        job.validationNote,
        ...job.columnPreview,
      ]
        .join(" ")
        .toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [jobs, keyword, status]);
  const importPage = useMemo(
    () => paginateOperationalRows(filteredJobs, page, pageSize),
    [filteredJobs, page, pageSize],
  );
  const exportHeaders = [
    "导入文件",
    "格式",
    "大小",
    "目标模块",
    "操作",
    "预览行数",
    "表头字段",
    "校验结果",
    "写入行数",
    "失败行数",
    "登记人",
    "登记时间",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredJobs.map((job) => [
        job.fileName,
        job.fileFormat,
        formatLocalFileSize(job.fileSize),
        job.moduleName,
        job.operation,
        job.rowCount === null ? "仅登记元数据" : `${job.rowCount} 行`,
        job.columnPreview.join("、") || "等待字段映射",
        job.validationNote,
        `${job.writtenRowCount || 0} 行`,
        `${job.failedRowCount || 0} 行`,
        job.operator,
        job.createdAt,
        job.status,
      ]),
    [filteredJobs],
  );

  const metrics = useMemo(
    () => ({
      pending: jobs.filter((job) => job.status === "待确认").length,
      verified: jobs.filter((job) => job.status === "已校验").length,
      written: jobs
        .filter((job) => job.status === "已写入")
        .reduce((sum, job) => sum + (job.writtenRowCount || 0), 0),
    }),
    [jobs],
  );

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (!ready) {
      setNotice("请先在顶部选择账套和账期，再登记导入批次。");
      return;
    }
    try {
      const created = await Promise.all(
        files.map((file) =>
          recordLocalImportJob({
            ...scope,
            moduleName,
            operation: "导入批次登记",
            file,
          }),
        ),
      );
      const completed = created.filter(Boolean).length;
      files.forEach((file) =>
        recordAuditLog({
          module: "导入历史",
          action: "登记导入批次",
          object: `${moduleName} - ${file.name}`,
          level: "中",
          result: "待审批",
          status: "待确认",
          attachment: file.name,
        }),
      );
      setNotice(
        `已登记 ${completed} 个本机导入批次并计算校验值。请先人工校验，再回到目标业务模块完成字段映射与写入。`,
      );
    } catch (error) {
      setNotice(`登记导入批次失败：${String(error)}`);
    }
  };

  const validateJob = async (job: LocalImportJob) => {
    try {
      const updated = await updateLocalImportJobValidation(job.id, scope.companyId);
      if (!updated) {
        setNotice("未找到该导入批次，无法完成校验。");
        return;
      }
      recordAuditLog({
        module: "导入历史",
        action: "人工校验导入批次",
        object: job.fileName,
        level: "中",
        attachment: job.fileName,
      });
      setNotice(
        "已记录人工表头与行数校验。此操作不会字段映射、写入账套或调用外部系统。",
      );
    } catch (error) {
      setNotice(`校验导入批次失败：${String(error)}`);
    }
  };

  const removeJob = async (job: LocalImportJob) => {
    try {
      if (!await removeLocalImportJob(job.id, scope.companyId)) {
        setNotice("未找到该导入批次，无法移除。");
        return;
      }
      recordAuditLog({
        module: "导入历史",
        action: "移除导入批次",
        object: job.fileName,
        level: "中",
        result: "待审批",
        status: "待确认",
        attachment: job.fileName,
      });
      setNotice("已移除本机导入批次登记，不会删除原始文件或已写入的业务数据。");
    } catch (error) {
      setNotice(`移除导入批次失败：${String(error)}`);
    }
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <WorkspaceHeader
          icon={<FileUp className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />}
          title="导入历史"
          description="集中登记导入文件、表头预览、人工校验和错误留痕；写入必须在对应业务模块明确完成。"
          period={period}
          actions={
            <>
              <OperationalExportActions
                title="导入批次清单"
                companyName={companyName}
                periodLabel={period}
                exportHeaders={exportHeaders}
                exportRows={exportRows}
                onNotice={setNotice}
              />
              <button
                type="button"
                onClick={() => setNotice("导入批次已按当前账套与账期刷新。")}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="inline-flex h-8 items-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82]"
              >
                <Upload className="h-3.5 w-3.5" />
                登记导入批次
              </button>
            </>
          }
        />
        <input
          ref={uploadRef}
          onChange={(event) => void handleImport(event)}
          type="file"
          multiple
          className="hidden"
          accept=".xlsx,.csv,.pdf,.ofd"
        />
        {notice && <Notice>{notice}</Notice>}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-4">
          <Metric label="导入批次" value={`${jobs.length} 个`} />
          <Metric
            label="待人工校验"
            value={`${metrics.pending} 个`}
            tone="amber"
          />
          <Metric
            label="已校验"
            value={`${metrics.verified} 个`}
            tone="green"
          />
          <Metric
            label="已写入行数"
            value={`${metrics.written} 行`}
            tone="slate"
          />
        </div>
        <div className="grid gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_160px_150px]">
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索文件名、来源模块、表头字段"
            className="h-8 w-full border border-slate-300 bg-white px-3 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
          />
          <select
            aria-label="导入来源模块"
            value={moduleName}
            onChange={(event) => setModuleName(event.target.value)}
            className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
          >
            {sourceModules.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="导入任务状态"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
          >
            <option>全部状态</option>
            <option>待确认</option>
            <option>已校验</option>
            <option>已写入</option>
            <option>异常</option>
          </select>
        </div>
        <div className="hidden p-3 lg:block">
          {filteredJobs.length === 0 ? (
            <EmptyState
              title="当前范围没有导入批次"
              description="支持登记 CSV、XLSX、PDF 和 OFD 文件；可解析文件将显示表头和行数预览。"
            />
          ) : (
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-[#202020] dark:text-slate-300">
                <tr>
                  <th className="w-[23%] px-3 py-2 font-medium">导入文件</th>
                  <th className="w-[13%] px-3 py-2 font-medium">目标模块</th>
                  <th className="w-[18%] px-3 py-2 font-medium">预览</th>
                  <th className="w-[24%] px-3 py-2 font-medium">校验结果</th>
                  <th className="w-[10%] px-3 py-2 font-medium">状态</th>
                  <th className="w-[12%] px-3 py-2 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {importPage.rows.map((job) => (
                  <tr
                    key={job.id}
                    className="border-t border-slate-100 align-top dark:border-slate-800"
                  >
                    <td className="break-words px-3 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {job.fileName}
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">
                        {job.fileFormat} · {formatLocalFileSize(job.fileSize)} ·{" "}
                        {job.createdAt}
                      </div>
                    </td>
                    <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
                      {job.moduleName}
                    </td>
                    <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
                      <div>
                        {job.rowCount === null
                          ? "仅登记元数据"
                          : `${job.rowCount} 行`}
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">
                        {job.columnPreview.join("、") || "等待字段映射"}
                      </div>
                    </td>
                    <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
                      {job.validationNote}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={job.status} />
                    </td>
                    <td className="px-3 py-3">
                      <ImportRowActions
                        job={job}
                        onValidate={validateJob}
                        onRemove={removeJob}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="space-y-2 p-3 lg:hidden">
          {filteredJobs.length === 0 ? (
            <EmptyState
              title="当前范围没有导入批次"
              description="请先登记导入文件。"
            />
          ) : (
            importPage.rows.map((job) => (
              <article
                key={job.id}
                className="border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium">
                      {job.fileName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {job.moduleName} ·{" "}
                      {job.rowCount === null
                        ? "仅登记元数据"
                        : `${job.rowCount} 行`}
                    </div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                <div className="mt-2 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {job.validationNote}
                </div>
                <div className="mt-3">
                  <ImportRowActions
                    job={job}
                    onValidate={validateJob}
                    onRemove={removeJob}
                  />
                </div>
              </article>
            ))
          )}
        </div>
        <OperationalPagination
          page={importPage}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </main>
  );
}

function DownloadRow({
  job,
  onInspect,
}: {
  job: ExportJob;
  onInspect: (job: ExportJob) => void;
}) {
  return (
    <tr className="border-t border-slate-100 align-top dark:border-slate-800">
      <td className="break-words px-3 py-3">
        <div className="font-medium text-slate-800 dark:text-slate-100">
          {job.fileName}
        </div>
        <div className="mt-1 text-slate-500 dark:text-slate-400">
          {job.format} · {job.templateKind}
        </div>
      </td>
      <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
        {job.moduleName}
      </td>
      <td className="break-words px-3 py-3 text-slate-600 dark:text-slate-300">
        <div>{job.scope}</div>
        <div className="mt-1 text-slate-500 dark:text-slate-400">
          {job.rowCount} 行 · {job.createdAt}
        </div>
      </td>
      <td className="break-all px-3 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
        {job.hash}
      </td>
      <td className="px-3 py-3">
        <StatusPill status={job.status} />
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={() => onInspect(job)}
          className="inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/30"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          审计信息
        </button>
      </td>
    </tr>
  );
}

export function DownloadCenterWorkspace() {
  const { period, companyName } = useFileScope();
  const jobs = useExportJobs('account');
  const auditLogs = useAuditLogs();
  const [keyword, setKeyword] = useState("");
  const [format, setFormat] = useState("全部格式");
  const [notice, setNotice] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filteredJobs = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesFormat = format === "全部格式" || job.format === format;
      const haystack = [
        job.fileName,
        job.moduleName,
        job.format,
        job.scope,
        job.hash,
      ]
        .join(" ")
        .toLowerCase();
      return matchesFormat && (!normalized || haystack.includes(normalized));
    });
  }, [format, jobs, keyword]);
  const downloadPage = useMemo(
    () => paginateOperationalRows(filteredJobs, page, pageSize),
    [filteredJobs, page, pageSize],
  );
  const exportHeaders = [
    "导出文件",
    "格式",
    "模板类型",
    "来源模块",
    "数据范围",
    "行数",
    "任务指纹",
    "操作人",
    "创建时间",
    "到期时间",
    "状态",
  ];
  const exportRows = useMemo(
    () =>
      filteredJobs.map((job) => [
        job.fileName,
        job.format,
        job.templateKind,
        job.moduleName,
        job.scope,
        `${job.rowCount} 行`,
        job.hash,
        job.operator,
        job.createdAt,
        job.expireAt,
        job.status,
      ]),
    [filteredJobs],
  );

  const formats = useMemo(
    () => [...new Set(jobs.map((job) => job.format))],
    [jobs],
  );
  const metrics = useMemo(
    () => ({
      ready: jobs.filter((job) => job.status === "已完成").length,
      pending: jobs.filter((job) => job.status === "待确认").length,
      modules: new Set(jobs.map((job) => job.moduleName)).size,
    }),
    [jobs],
  );

  const inspect = (job: ExportJob) => {
    recordAuditLog({
      module: "下载中心",
      action: "查看导出任务",
      object: job.fileName,
      attachment: job.hash,
    });
    setNotice(
      `已记录查看操作。文件由创建页面或浏览器下载管理器保存；下载中心不重新生成或伪造文件内容。`,
    );
    setShowAudit(true);
  };

  return (
    <main className="min-h-full bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <WorkspaceHeader
          icon={
            <Download className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
          }
          title="账套下载中心"
          description="按文件格式、来源模块、账期和任务指纹查看当前账套已生成的本地导出任务，不重建文件内容。"
          period={period}
          actions={
            <>
              <OperationalExportActions
                title="下载任务清单"
                companyName={companyName}
                periodLabel={period}
                exportHeaders={exportHeaders}
                exportRows={exportRows}
                onNotice={setNotice}
              />
              <button
                type="button"
                onClick={() => setNotice("导出任务列表已刷新。")}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                刷新
              </button>
              <button
                type="button"
                onClick={() => setShowAudit((value) => !value)}
                className="inline-flex h-8 items-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ClipboardCheck className="h-3.5 w-3.5" />
                规则与日志
              </button>
            </>
          }
        />
        {notice && <Notice>{notice}</Notice>}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-4">
          <Metric label="导出任务" value={`${jobs.length} 个`} />
          <Metric label="已完成" value={`${metrics.ready} 个`} tone="green" />
          <Metric label="待确认" value={`${metrics.pending} 个`} tone="amber" />
          <Metric
            label="来源模块"
            value={`${metrics.modules} 个`}
            tone="slate"
          />
        </div>
        {showAudit && (
          <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0d0d0d] lg:grid-cols-2">
            <div className="border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111827]">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                文件规则
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                仅展示已经由业务页面生成的导出任务。页面不读取外部网盘、不伪造文件链接，也不改变原始导出范围。
              </p>
            </div>
            <div className="border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-[#111827]">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileClock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                近期操作日志
              </div>
              <div className="mt-2 space-y-2">
                {auditLogs
                  .filter(
                    (log) =>
                      log.module === "下载中心" ||
                      log.action.startsWith("导出"),
                  )
                  .slice(0, 4)
                  .map((log) => (
                    <div
                      key={log.id}
                      className="border-t border-slate-100 pt-2 text-xs dark:border-slate-800"
                    >
                      <div className="flex justify-between gap-3">
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {log.action}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {log.time}
                        </span>
                      </div>
                      <div className="mt-1 break-words text-slate-500 dark:text-slate-400">
                        {log.object}
                      </div>
                    </div>
                  ))}
                {auditLogs.filter(
                  (log) =>
                    log.module === "下载中心" || log.action.startsWith("导出"),
                ).length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    当前范围没有可显示的导出审计记录。
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800 lg:flex-row">
          <input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder="搜索文件名、模块、账期、任务指纹"
            className="h-8 w-full border border-slate-300 bg-white px-3 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f] lg:max-w-md"
          />
          <select
            aria-label="下载文件格式"
            value={format}
            onChange={(event) => {
              setFormat(event.target.value);
              setPage(1);
            }}
            className="h-8 border border-slate-300 bg-white px-2 text-xs outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-[#0f0f0f]"
          >
            <option>全部格式</option>
            {formats.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="hidden p-3 lg:block">
          {filteredJobs.length === 0 ? (
            <EmptyState
              title="尚无可管理的导出任务"
              description="请先在报表、账簿、税务或业务模块中执行实际导出。生成的本地任务会携带范围、行数和任务指纹。"
            />
          ) : (
            <table className="w-full table-fixed text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 dark:bg-[#202020] dark:text-slate-300">
                <tr>
                  <th className="w-[25%] px-3 py-2 font-medium">导出文件</th>
                  <th className="w-[16%] px-3 py-2 font-medium">来源模块</th>
                  <th className="w-[21%] px-3 py-2 font-medium">范围与时间</th>
                  <th className="w-[18%] px-3 py-2 font-medium">任务指纹</th>
                  <th className="w-[9%] px-3 py-2 font-medium">状态</th>
                  <th className="w-[11%] px-3 py-2 text-right font-medium">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {downloadPage.rows.map((job) => (
                  <DownloadRow key={job.id} job={job} onInspect={inspect} />
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="space-y-2 p-3 lg:hidden">
          {filteredJobs.length === 0 ? (
            <EmptyState
              title="尚无可管理的导出任务"
              description="请先从对应业务模块生成导出文件。"
            />
          ) : (
            downloadPage.rows.map((job) => (
              <article
                key={job.id}
                className="border border-slate-200 p-3 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-medium">
                      {job.fileName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {job.moduleName} · {job.format} · {job.scope}
                    </div>
                  </div>
                  <StatusPill status={job.status} />
                </div>
                <div className="mt-2 break-all font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {job.hash}
                </div>
                <button
                  type="button"
                  onClick={() => inspect(job)}
                  className="mt-3 inline-flex h-7 items-center gap-1 border border-sky-300 px-2 text-xs text-sky-700 dark:border-sky-800 dark:text-sky-300"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  审计信息
                </button>
              </article>
            ))
          )}
        </div>
        <OperationalPagination
          page={downloadPage}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </main>
  );
}
