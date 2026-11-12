import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  DatabaseBackup,
  FileCheck2,
  HardDriveDownload,
  History,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OperationalExportActions } from "../../components/operations/OperationalExportActions";
import { OperationalPagination } from "../../components/operations/OperationalPagination";
import {
  backupApi,
  type LocalBackupSnapshot,
  type LocalBackupVerification,
} from "../../lib/api";
import { recordAuditLog } from "../../lib/exportJobs";
import { paginateOperationalRows } from "../../lib/operationalPagination";
import { isTauri } from "../../lib/tauri";

const previewSnapshotStorageKey = "accounting-preview-backup-snapshots-v1";
const previewValidationStorageKey = "accounting-preview-backup-validations-v1";

function loadPreviewSnapshots(): LocalBackupSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewSnapshotStorageKey) || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((snapshot): snapshot is LocalBackupSnapshot =>
      Boolean(
        snapshot &&
        typeof snapshot.id === "string" &&
        typeof snapshot.fileName === "string" &&
        typeof snapshot.createdAt === "string" &&
        Number.isFinite(snapshot.sizeBytes),
      ),
    );
  } catch {
    return [];
  }
}

function savePreviewSnapshots(snapshots: LocalBackupSnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      previewSnapshotStorageKey,
      JSON.stringify(snapshots),
    );
  } catch {
    // Browser preview storage is optional and must not block the workspace.
  }
}

function loadPreviewVerifications(): Record<string, LocalBackupVerification> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(previewValidationStorageKey) || "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([id, value]) => {
        const verification = value as Partial<LocalBackupVerification>;
        return typeof verification.id === "string" &&
          typeof verification.fileName === "string" &&
          typeof verification.valid === "boolean" &&
          typeof verification.message === "string"
          ? [[id, verification as LocalBackupVerification]]
          : [];
      }),
    );
  } catch {
    return {};
  }
}

function savePreviewVerifications(
  verifications: Record<string, LocalBackupVerification>,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      previewValidationStorageKey,
      JSON.stringify(verifications),
    );
  } catch {
    // Browser preview storage is optional and must not block the workspace.
  }
}

function createPreviewSnapshot(): LocalBackupSnapshot {
  const createdAt = new Date().toISOString();
  const descriptor = JSON.stringify({
    scope: "browser-preview-metadata",
    createdAt,
    capability: "validation-only",
  });
  const timestamp = createdAt.replace(/[-:.TZ]/g, "").slice(0, 14);
  return {
    id: `preview-backup-${Date.now()}`,
    fileName: `浏览器预览-${timestamp}.snapshot.json`,
    createdAt,
    sizeBytes: new TextEncoder().encode(descriptor).byteLength,
  };
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "未记录"
    : new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(date);
}

function formatSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function verificationLabel(verification: LocalBackupVerification | undefined) {
  if (!verification) return "待校验";
  return verification.valid ? "校验通过" : "校验失败";
}

function verificationClass(verification: LocalBackupVerification | undefined) {
  if (!verification)
    return "border-amber-300 text-amber-700 dark:border-amber-900 dark:text-amber-300";
  return verification.valid
    ? "border-emerald-300 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
    : "border-rose-300 text-rose-700 dark:border-rose-900 dark:text-rose-300";
}

export function BackupRestoreWorkspace() {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<LocalBackupSnapshot[]>(() =>
    isTauri ? [] : loadPreviewSnapshots(),
  );
  const [verifications, setVerifications] = useState<
    Record<string, LocalBackupVerification>
  >(() => (isTauri ? {} : loadPreviewVerifications()));
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!isTauri) {
      setSnapshots(loadPreviewSnapshots());
      setVerifications(loadPreviewVerifications());
      return;
    }
    setLoading(true);
    try {
      const response = await backupApi.listLocalBackups();
      if (!response.success)
        throw new Error(response.error || "无法读取本地快照");
      setSnapshots(response.data || []);
    } catch (reason) {
      setSnapshots([]);
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const orderedSnapshots = useMemo(
    () =>
      snapshots
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [snapshots],
  );
  const snapshotPage = useMemo(
    () => paginateOperationalRows(orderedSnapshots, page, pageSize),
    [orderedSnapshots, page, pageSize],
  );
  const exportHeaders = [
    "快照文件",
    "运行模式",
    "创建时间",
    "大小",
    "校验状态",
    "校验说明",
  ];
  const exportRows = useMemo(
    () =>
      orderedSnapshots.map((snapshot) => {
        const verification = verifications[snapshot.id];
        return [
          snapshot.fileName,
          isTauri ? "本地 SQLite 快照" : "浏览器预览元数据",
          formatDateTime(snapshot.createdAt),
          formatSize(snapshot.sizeBytes),
          verificationLabel(verification),
          verification?.message || "未执行文件校验",
        ];
      }),
    [orderedSnapshots, verifications],
  );
  const metrics = useMemo(() => {
    const totalBytes = snapshots.reduce(
      (total, snapshot) => total + snapshot.sizeBytes,
      0,
    );
    const checked = snapshots.filter(
      (snapshot) => verifications[snapshot.id]?.valid,
    ).length;
    const failed = snapshots.filter(
      (snapshot) =>
        verifications[snapshot.id] && !verifications[snapshot.id].valid,
    ).length;
    return {
      totalBytes,
      checked,
      failed,
      pending: Math.max(snapshots.length - checked - failed, 0),
    };
  }, [snapshots, verifications]);

  const updateBrowserSnapshots = (next: LocalBackupSnapshot[]) => {
    setSnapshots(next);
    savePreviewSnapshots(next);
  };

  const updateBrowserVerifications = (
    next: Record<string, LocalBackupVerification>,
  ) => {
    setVerifications(next);
    savePreviewVerifications(next);
  };

  const createSnapshot = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      if (!isTauri) {
        const snapshot = createPreviewSnapshot();
        updateBrowserSnapshots([snapshot, ...snapshots]);
        recordAuditLog({
          module: "备份恢复",
          action: "创建预览备份快照",
          object: snapshot.fileName,
          level: "中",
          attachment: "浏览器预览元数据",
        });
        setNotice(
          "已保存浏览器预览快照元数据；不会生成真实备份文件，不能用于恢复或覆盖账套。",
        );
        return;
      }
      const response = await backupApi.createLocalBackup();
      if (!response.success || !response.data)
        throw new Error(response.error || "未返回本地快照");
      setSnapshots((current) => [
        response.data!,
        ...current.filter((snapshot) => snapshot.id !== response.data!.id),
      ]);
      setNotice(`已创建本地 SQLite 快照：${response.data.fileName}`);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setCreating(false);
    }
  };

  const verifySnapshot = async (snapshot: LocalBackupSnapshot) => {
    setVerifyingId(snapshot.id);
    setError(null);
    setNotice(null);
    try {
      if (!isTauri) {
        const verification: LocalBackupVerification = {
          id: snapshot.id,
          fileName: snapshot.fileName,
          valid:
            snapshot.fileName.endsWith(".snapshot.json") &&
            snapshot.sizeBytes > 0,
          message:
            "预览快照元数据结构已核验；该记录不包含真实备份文件，不能执行恢复。",
        };
        const next = { ...verifications, [snapshot.id]: verification };
        updateBrowserVerifications(next);
        recordAuditLog({
          module: "备份恢复",
          action: "核验预览备份快照",
          object: snapshot.fileName,
          level: verification.valid ? "普通" : "高",
          result: verification.valid ? "成功" : "失败",
          attachment: verification.message,
        });
        setNotice(verification.message);
        return;
      }
      const response = await backupApi.verifyLocalBackup(snapshot.id);
      if (!response.success || !response.data)
        throw new Error(response.error || "未返回快照校验结果");
      setVerifications((current) => ({
        ...current,
        [snapshot.id]: response.data!,
      }));
      setNotice(response.data.message);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setVerifyingId(null);
    }
  };

  const scheduleRestore = async (snapshot: LocalBackupSnapshot) => {
    const verification = verifications[snapshot.id];
    if (!isTauri || !verification?.valid) {
      setError("必须先在桌面端完成快照完整性校验，才能安排恢复。");
      return;
    }
    const confirmed = window.confirm(
      `确定安排恢复快照“${snapshot.fileName}”吗？系统会先创建恢复前安全快照；目标快照将在下次启动、数据库连接建立前生效。安排后请立即退出并重新打开应用。`,
    );
    if (!confirmed) return;

    setRestoringId(snapshot.id);
    setError(null);
    setNotice(null);
    try {
      const response = await backupApi.scheduleLocalBackupRestore(snapshot.id);
      if (!response.success || !response.data) {
        throw new Error(response.error || "未返回恢复安排结果");
      }
      setNotice(
        `${response.data.message} 恢复前安全快照：${response.data.safetyBackupId}`,
      );
    } catch (reason) {
      setError(String(reason));
    } finally {
      setRestoringId(null);
    }
  };

  const exportSnapshot = async (snapshot: LocalBackupSnapshot) => {
    if (!isTauri || !verifications[snapshot.id]?.valid) {
      setError("必须先完成快照完整性校验，才能导出副本。");
      return;
    }
    setExportingId(snapshot.id);
    setError(null);
    setNotice(null);
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const targetPath = await save({
        title: "导出备份副本",
        defaultPath: snapshot.fileName,
        filters: [{ name: "SQLite 备份", extensions: ["db"] }],
      });
      if (!targetPath) return;
      const response = await backupApi.exportLocalBackup(
        snapshot.id,
        targetPath,
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "未返回备份导出结果");
      }
      setNotice(response.data.message);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setExportingId(null);
    }
  };

  return (
    <main className="min-h-full min-w-0 bg-slate-50 p-3 text-slate-900 dark:bg-[#0d0d0d] dark:text-slate-100">
      <section
        data-operational-export-root
        className="min-w-0 border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]"
      >
        <header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4 text-[#1f65a7] dark:text-sky-400" />
              <h1 className="text-base font-semibold">备份恢复</h1>
            </div>
            <p className="mt-1 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
              创建账套 SQLite
              快照、核验文件完整性，并为受控恢复流程保留可复核的前置依据。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <OperationalExportActions
              title="备份快照清单"
              exportHeaders={exportHeaders}
              exportRows={exportRows}
              onNotice={setNotice}
            />
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading || creating}
              className="inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              刷新
            </button>
            <button
              type="button"
              onClick={() => void createSnapshot()}
              disabled={creating || loading}
              className="inline-flex h-8 items-center justify-center gap-1 bg-[#1f65a7] px-3 text-xs font-medium text-white hover:bg-[#174f82] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              <HardDriveDownload className="h-3.5 w-3.5" />
              {creating ? "正在备份" : "立即备份"}
            </button>
          </div>
        </header>
        <div className="grid gap-3 border-b border-slate-200 p-3 dark:border-slate-800 lg:grid-cols-2">
          <section className="border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-100">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5" />
              恢复边界
            </div>
            <p className="mt-1">
              桌面端校验通过后可安排受控恢复。系统会先生成恢复前安全快照，并在下次启动、数据库连接建立前替换账套；浏览器预览不执行恢复。
            </p>
          </section>
          <section className="border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
              <ArchiveRestore className="h-3.5 w-3.5 text-[#1f65a7] dark:text-sky-400" />
              当前运行模式
            </div>
            <p className="mt-1">
              {isTauri
                ? "桌面端每天自动创建一次一致性快照，自动快照最多保留 30 份；手工快照和恢复前安全快照不会被自动清理。"
                : "浏览器预览只保存快照元数据，用于演示创建与校验流程，不产生可恢复文件。"}
            </p>
          </section>
        </div>
        <div className="grid divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800 dark:border-slate-800">
          <Metric
            icon={DatabaseBackup}
            label="快照数量"
            value={`${snapshots.length} 个`}
          />
          <Metric
            icon={HardDriveDownload}
            label={isTauri ? "本地容量" : "元数据大小"}
            value={formatSize(metrics.totalBytes)}
            tone="text-sky-700 dark:text-sky-300"
          />
          <Metric
            icon={CheckCircle2}
            label="校验通过"
            value={`${metrics.checked} 个`}
            tone={
              metrics.checked
                ? "text-emerald-600 dark:text-emerald-400"
                : undefined
            }
          />
          <Metric
            icon={AlertTriangle}
            label="待处理"
            value={`${metrics.pending + metrics.failed} 个`}
            tone={
              metrics.pending + metrics.failed
                ? "text-amber-600 dark:text-amber-400"
                : undefined
            }
          />
        </div>
        {error && <Notice tone="error" value={`备份操作失败：${error}`} />}
        {notice && <Notice tone="info" value={notice} />}
        {loading ? (
          <EmptyState message="正在读取本地快照..." />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>快照清单</span>
              <span>
                {isTauri
                  ? "校验包含 SQLite 文件头和完整性检查"
                  : "浏览器预览元数据不可用于恢复"}
              </span>
            </div>
            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 dark:bg-[#0d1423] dark:text-slate-400">
                  <tr>
                    <th className="w-[25%] px-4 py-3 font-medium">快照文件</th>
                    <th className="w-[16%] px-4 py-3 font-medium">创建时间</th>
                    <th className="w-[9%] px-4 py-3 font-medium">大小</th>
                    <th className="w-[18%] px-4 py-3 font-medium">校验状态</th>
                    <th className="w-[32%] px-4 py-3 text-right font-medium">
                      下一步
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {snapshotPage.rows.map((snapshot) => {
                    const verification = verifications[snapshot.id];
                    return (
                      <tr
                        key={snapshot.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <p
                            className="truncate font-medium"
                            title={snapshot.fileName}
                          >
                            {snapshot.fileName}
                          </p>
                          <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                            {isTauri ? "本地 SQLite 快照" : "浏览器预览元数据"}
                          </p>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatDateTime(snapshot.createdAt)}
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatSize(snapshot.sizeBytes)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            value={verificationLabel(verification)}
                            className={verificationClass(verification)}
                          />
                          <p
                            className="mt-1 truncate text-slate-500 dark:text-slate-400"
                            title={verification?.message}
                          >
                            {verification?.message || "请先执行文件校验"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void verifySnapshot(snapshot)}
                              disabled={verifyingId === snapshot.id || exportingId === snapshot.id || restoringId === snapshot.id || creating}
                              className="inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <FileCheck2 className="h-3.5 w-3.5" />
                              {verifyingId === snapshot.id ? "正在校验" : "核验快照"}
                            </button>
                            {isTauri && verification?.valid && (
                              <button
                                type="button"
                                onClick={() => void exportSnapshot(snapshot)}
                                disabled={exportingId === snapshot.id || restoringId === snapshot.id || creating}
                                className="inline-flex h-8 items-center justify-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
                              >
                                <HardDriveDownload className="h-3.5 w-3.5" />
                                {exportingId === snapshot.id ? "正在导出" : "导出副本"}
                              </button>
                            )}
                            {isTauri && verification?.valid && (
                              <button
                                type="button"
                                onClick={() => void scheduleRestore(snapshot)}
                                disabled={restoringId === snapshot.id || exportingId === snapshot.id || creating}
                                className="inline-flex h-8 items-center justify-center gap-1 border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                              >
                                <ArchiveRestore className="h-3.5 w-3.5" />
                                {restoringId === snapshot.id ? "正在安排" : "安排恢复"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 p-3 lg:hidden">
              {snapshotPage.rows.map((snapshot) => {
                const verification = verifications[snapshot.id];
                return (
                  <article
                    key={snapshot.id}
                    className="border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium"
                          title={snapshot.fileName}
                        >
                          {snapshot.fileName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(snapshot.createdAt)} ·{" "}
                          {formatSize(snapshot.sizeBytes)}
                        </p>
                      </div>
                      <Badge
                        value={verificationLabel(verification)}
                        className={verificationClass(verification)}
                      />
                    </div>
                    <p className="mt-3 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {verification?.message ||
                        (isTauri
                          ? "未执行文件头校验。"
                          : "浏览器预览元数据不可用于恢复。")}
                    </p>
                    <button
                      type="button"
                      onClick={() => void verifySnapshot(snapshot)}
                      disabled={verifyingId === snapshot.id || exportingId === snapshot.id || creating}
                      className="mt-3 inline-flex h-8 items-center justify-center gap-1 border border-slate-300 px-3 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      {verifyingId === snapshot.id ? "正在校验" : "核验快照"}
                    </button>
                    {isTauri && verification?.valid && (
                      <button
                        type="button"
                        onClick={() => void exportSnapshot(snapshot)}
                        disabled={exportingId === snapshot.id || restoringId === snapshot.id || creating}
                        className="ml-2 mt-3 inline-flex h-8 items-center justify-center gap-1 border border-sky-300 px-3 text-xs text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
                      >
                        <HardDriveDownload className="h-3.5 w-3.5" />
                        {exportingId === snapshot.id ? "正在导出" : "导出副本"}
                      </button>
                    )}
                    {isTauri && verification?.valid && (
                      <button
                        type="button"
                        onClick={() => void scheduleRestore(snapshot)}
                        disabled={restoringId === snapshot.id || exportingId === snapshot.id || creating}
                        className="ml-2 mt-3 inline-flex h-8 items-center justify-center gap-1 border border-rose-300 px-3 text-xs text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        {restoringId === snapshot.id ? "正在安排" : "安排恢复"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            {orderedSnapshots.length === 0 && (
              <EmptyState
                message={
                  isTauri
                    ? "当前没有本地备份快照。创建快照后可在此核验文件完整性。"
                    : "当前没有浏览器预览快照。预览快照只保存元数据，不包含真实账套文件。"
                }
              />
            )}
            <OperationalPagination
              page={snapshotPage}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      <section className="mt-3 grid gap-3 lg:grid-cols-3">
        <QuickLink
          icon={History}
          title="审计日志"
          description="复核快照创建与校验对应的操作留痕。"
          onClick={() => navigate("/settings/audit-log")}
        />
        <QuickLink
          icon={ShieldCheck}
          title="账期管理"
          description="在账期调整前先创建可校验快照。"
          onClick={() => navigate("/settings/period-management")}
        />
        <QuickLink
          icon={ArchiveRestore}
          title="公司信息"
          description="核对当前账套资料后，再按人工流程执行恢复。"
          onClick={() => navigate("/settings/company-info")}
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
function Badge({ value, className }: { value: string; className: string }) {
  return (
    <span
      className={`inline-flex shrink-0 border px-2 py-0.5 text-xs ${className}`}
    >
      {value}
    </span>
  );
}
function Notice({ value, tone }: { value: string; tone: "error" | "info" }) {
  return (
    <div
      className={
        tone === "error"
          ? "border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200"
          : "border-b border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-200"
      }
    >
      {value}
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
      {message}
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
