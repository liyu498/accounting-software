const BUSINESS_STORAGE_KEY = "accounting-preview-document-business-data-v2";
const TRANSFER_STORAGE_KEY = "accounting-preview-account-transfer-data-v1";
const COST_CARRYOVER_STORAGE_KEY = "accounting-preview-cost-carryover-data-v1";
const SUPPORTED_KINDS = new Set([
  "document_record",
  "business_order",
  "account_transfer",
  "cost_carryover",
  "payroll_batch",
  "social_security_batch",
  "depreciation_batch",
]);

function text(value) {
  return String(value ?? "").trim();
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function activeDetail(account) {
  return Number(account?.is_enabled ?? 1) === 1 && Number(account?.is_detail ?? 1) === 1;
}

function findAccount(accounts, preferred) {
  const value = text(preferred);
  const code = value.match(/^\d{4,}/)?.[0] || value;
  return (Array.isArray(accounts) ? accounts : []).find(
    (account) =>
      activeDetail(account) &&
      (text(account.code) === code ||
        text(account.name) === value ||
        value.startsWith(`${text(account.code)} `)),
  );
}

function accountEntry(accounts, preferred) {
  const account = findAccount(accounts, preferred);
  return {
    accountCode: text(account?.code),
    accountName: text(account?.name),
  };
}

function sourceVoucherId(record) {
  return text(record?.voucherId ?? record?.voucher_id);
}

function assertSource(kind, record, periodLabel) {
  if (!SUPPORTED_KINDS.has(kind) || !record || !text(record.id)) {
    throw new Error("业务来源类型或标识无效");
  }
  if (
    sourceVoucherId(record) ||
    text(record.status) === "已生成凭证" ||
    (kind === "cost_carryover" && text(record.voucherNo ?? record.voucher_no))
  ) {
    throw new Error("业务来源已关联凭证，不能重复生成草稿");
  }
  if (text(record.period) !== text(periodLabel)) {
    throw new Error("业务来源账期与当前账期不一致");
  }
}

function sharedEntry(summary, referenceNumber, amount) {
  return {
    summary,
    docNumber: referenceNumber,
    amount: String(money(amount)),
  };
}

function periodEndDate(period) {
  const match = text(period).match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0))
    .toISOString()
    .slice(0, 10);
}

export function buildBusinessVoucherPrefill({ kind, record, accounts, periodLabel }) {
  assertSource(kind, record, periodLabel);
  const amount = money(
    kind === "cost_carryover"
      ? record.costAmount ?? record.cost_amount
      : kind === "payroll_batch"
        ? (Array.isArray(record.records) ? record.records : []).reduce(
            (total, item) => total + money(item.baseSalary ?? item.base_salary) + money(item.bonus),
            0,
          )
      : kind === "social_security_batch"
        ? (Array.isArray(record.records) ? record.records : []).reduce(
            (total, item) => total + money(item.companyAmount ?? item.company_amount) + money(item.fundAmount ?? item.fund_amount),
            0,
          )
      : kind === "depreciation_batch"
        ? (Array.isArray(record.records) ? record.records : []).reduce(
            (total, item) =>
              total + money(item.depreciationAmount ?? item.depreciation_amount),
            0,
          )
      : record.amount,
  );
  if (amount <= 0) throw new Error("业务来源金额必须大于零");

  if (kind === "document_record") {
    const referenceNumber = text(record.documentCode ?? record.document_code);
    const voucherDate = text(record.businessDate ?? record.business_date);
    const businessType = text(record.businessType ?? record.business_type);
    if (!referenceNumber || !voucherDate || !businessType) {
      throw new Error("业务单据缺少日期、编号或类型");
    }
    const partner = text(record.partner);
    const summary = `${businessType}${partner ? ` - ${partner}` : ""}`;
    let debit = "";
    let credit = "";
    if (/费用|报销/.test(businessType)) {
      debit = "6602";
      credit = "1002";
    } else if (/销售|出库/.test(businessType)) {
      debit = "1122";
      credit = "5001";
    } else if (/采购|入库/.test(businessType)) {
      debit = "1405";
      credit = "2202";
    }
    const shared = sharedEntry(summary, referenceNumber, amount);
    return {
      voucherDate,
      summary,
      referenceNumber,
      entries: [
        { ...shared, ...accountEntry(accounts, debit), direction: "debit" },
        { ...shared, ...accountEntry(accounts, credit), direction: "credit" },
      ],
    };
  }

  if (kind === "business_order") {
    const orderType = text(record.orderType ?? record.order_type);
    const referenceNumber = text(record.orderNo ?? record.order_no);
    const voucherDate = text(record.businessDate ?? record.business_date);
    if (!['purchase', 'sales'].includes(orderType) || !referenceNumber || !voucherDate) {
      throw new Error("采购销售订单缺少有效类型、日期或编号");
    }
    const counterparty = text(record.counterparty);
    const goodsName = text(record.goodsName ?? record.goods_name);
    const summary = `${orderType === "sales" ? "销售" : "采购"}${goodsName || "商品服务"}${counterparty ? ` - ${counterparty}` : ""}`;
    const shared = sharedEntry(summary, referenceNumber, amount);
    return {
      voucherDate,
      summary,
      referenceNumber,
      entries: orderType === "sales"
        ? [
            { ...shared, ...accountEntry(accounts, "1122"), direction: "debit" },
            { ...shared, ...accountEntry(accounts, "5001"), direction: "credit" },
          ]
        : [
            { ...shared, ...accountEntry(accounts, "1405"), direction: "debit" },
            { ...shared, ...accountEntry(accounts, "2202"), direction: "credit" },
          ],
    };
  }

  if (kind === "cost_carryover") {
    const referenceNumber = text(record.batchNo ?? record.batch_no);
    const voucherDate = text(record.carryoverDate ?? record.carryover_date);
    const inventoryName = text(record.inventoryName ?? record.inventory_name);
    const debitSubject = text(record.debitSubject ?? record.debit_subject);
    const creditSubject = text(record.creditSubject ?? record.credit_subject);
    if (!referenceNumber || !voucherDate || !debitSubject || !creditSubject) {
      throw new Error("成本结转缺少日期、批次或借贷科目");
    }
    const summary = `结转${inventoryName || "存货"}成本`;
    const shared = sharedEntry(summary, referenceNumber, amount);
    return {
      voucherDate,
      summary,
      referenceNumber,
      entries: [
        { ...shared, ...accountEntry(accounts, debitSubject), direction: "debit" },
        { ...shared, ...accountEntry(accounts, creditSubject), direction: "credit" },
      ],
    };
  }

  if (kind === "payroll_batch") {
    const records = Array.isArray(record.records) ? record.records : [];
    if (records.length === 0) throw new Error("当前账期没有可生成凭证的薪酬行");
    const totals = records.reduce(
      (result, item) => ({
        gross: result.gross + money(item.baseSalary ?? item.base_salary) + money(item.bonus),
        net: result.net + money(item.netSalary ?? item.net_salary),
        tax: result.tax + money(item.taxAmount ?? item.tax_amount),
        social: result.social + money(item.socialPersonal ?? item.social_personal),
      }),
      { gross: 0, net: 0, tax: 0, social: 0 },
    );
    const withheld = money(totals.tax + totals.social);
    if (
      totals.gross <= 0 ||
      totals.net < 0 ||
      withheld < 0 ||
      Math.abs(totals.gross - totals.net - withheld) >= 0.005
    ) {
      throw new Error("薪酬汇总与实发、个税和个人社保不平衡");
    }
    const referenceNumber = `GZ-${text(record.period)}`;
    const summary = `${text(record.period)} 工资计提`;
    const shared = sharedEntry(summary, referenceNumber, totals.gross);
    const entries = [
      { ...shared, ...accountEntry(accounts, "6602"), direction: "debit" },
    ];
    if (totals.net > 0) {
      entries.push({
        ...sharedEntry(summary, referenceNumber, totals.net),
        ...accountEntry(accounts, "2211"),
        direction: "credit",
      });
    }
    if (withheld > 0) {
      entries.push({
        ...sharedEntry(`${summary}代扣`, referenceNumber, withheld),
        ...accountEntry(accounts, "2221"),
        direction: "credit",
      });
    }
    return {
      voucherDate: text(record.voucherDate) || periodEndDate(record.period),
      summary,
      referenceNumber,
      entries,
    };
  }

  if (kind === "social_security_batch") {
    const records = Array.isArray(record.records) ? record.records : [];
    if (records.length === 0) throw new Error("当前账期没有可生成凭证的社保缴费行");
    const employerAmount = money(
      records.reduce(
        (total, item) =>
          total +
          money(item.companyAmount ?? item.company_amount) +
          money(item.fundAmount ?? item.fund_amount),
        0,
      ),
    );
    if (employerAmount <= 0) throw new Error("单位社保和公积金合计必须大于零");
    const referenceNumber = `SB-${text(record.period)}`;
    const summary = `${text(record.period)} 社保公积金计提`;
    const shared = sharedEntry(summary, referenceNumber, employerAmount);
    return {
      voucherDate: text(record.voucherDate) || periodEndDate(record.period),
      summary,
      referenceNumber,
      entries: [
        { ...shared, ...accountEntry(accounts, "6602"), direction: "debit" },
        { ...shared, ...accountEntry(accounts, "2211"), direction: "credit" },
      ],
    };
  }

  if (kind === "depreciation_batch") {
    const records = Array.isArray(record.records) ? record.records : [];
    if (records.length === 0) throw new Error("当前账期没有已计算的折旧明细");
    if (text(record.status) !== "待复核") {
      throw new Error("折旧批次状态不是待复核，不能生成凭证草稿");
    }
    const depreciationAmount = money(records.reduce(
      (total, item) => total + money(item.depreciationAmount ?? item.depreciation_amount),
      0,
    ));
    if (depreciationAmount <= 0) throw new Error("本期折旧金额必须大于零");
    const batchAmount = money(
      record.batch?.depreciationAmount ?? record.batch?.depreciation_amount,
    );
    if (batchAmount <= 0 || Math.abs(batchAmount - depreciationAmount) >= 0.005) {
      throw new Error("折旧明细合计与批次金额不一致，请重新计算");
    }
    const referenceNumber = `ZJ-${text(record.period)}`;
    const summary = `${text(record.period)} 固定资产折旧计提`;
    const debitGroups = new Map();
    const creditGroups = new Map();
    for (const item of records) {
      const lineAmount = money(item.depreciationAmount ?? item.depreciation_amount);
      const expense = text(item.expenseAccount ?? item.expense_account);
      const accumulated = text(
        item.accumulatedDepreciationAccount ?? item.accumulated_depreciation_account,
      );
      if (lineAmount <= 0 || !expense || !accumulated) {
        throw new Error("折旧明细缺少有效金额或会计科目");
      }
      debitGroups.set(expense, money((debitGroups.get(expense) || 0) + lineAmount));
      creditGroups.set(
        accumulated,
        money((creditGroups.get(accumulated) || 0) + lineAmount),
      );
    }
    const entries = [];
    for (const [subject, groupedAmount] of [...debitGroups.entries()].sort()) {
      entries.push({
        ...sharedEntry(summary, referenceNumber, groupedAmount),
        ...accountEntry(accounts, subject),
        direction: "debit",
      });
    }
    for (const [subject, groupedAmount] of [...creditGroups.entries()].sort()) {
      entries.push({
        ...sharedEntry(summary, referenceNumber, groupedAmount),
        ...accountEntry(accounts, subject),
        direction: "credit",
      });
    }
    return {
      voucherDate: text(record.voucherDate) || periodEndDate(record.period),
      summary,
      referenceNumber,
      entries,
    };
  }

  const referenceNumber = text(record.serialNo ?? record.serial_no) || text(record.id);
  const voucherDate = text(record.transferDate ?? record.transfer_date);
  const fromAccount = text(record.fromAccount ?? record.from_account);
  const toAccount = text(record.toAccount ?? record.to_account);
  const fee = money(record.fee);
  if (!voucherDate || !fromAccount || !toAccount || fee < 0) {
    throw new Error("账户转账缺少日期、转出转入账户或手续费无效");
  }
  const summary = `内部转账 ${fromAccount} 至 ${toAccount}`;
  const transferShared = sharedEntry(summary, referenceNumber, amount);
  const entries = [
    { ...transferShared, ...accountEntry(accounts, toAccount), direction: "debit" },
  ];
  if (fee > 0) {
    entries.push({
      ...sharedEntry("银行手续费", referenceNumber, fee),
      ...accountEntry(accounts, "6602"),
      direction: "debit",
    });
  }
  entries.push({
    ...sharedEntry(summary, referenceNumber, amount + fee),
    ...accountEntry(accounts, fromAccount),
    direction: "credit",
  });
  return { voucherDate, summary, referenceNumber, entries };
}

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadBrowserBusinessVoucherSource(kind, id) {
  if (!SUPPORTED_KINDS.has(kind) || !text(id)) return null;
  if (kind === "cost_carryover") {
    const records = readStorage(COST_CARRYOVER_STORAGE_KEY, []);
    return Array.isArray(records) ? records.find((record) => record?.id === id) || null : null;
  }
  if (kind === "account_transfer") {
    const records = readStorage(TRANSFER_STORAGE_KEY, []);
    return Array.isArray(records) ? records.find((record) => record?.id === id) || null : null;
  }
  const data = readStorage(BUSINESS_STORAGE_KEY, {
    documentRecords: [],
    businessOrders: [],
  });
  const collection = kind === "document_record" ? data.documentRecords : data.businessOrders;
  return Array.isArray(collection)
    ? collection.find((record) => record?.id === id) || null
    : null;
}

export function linkBrowserBusinessVoucherSource({ kind, id, voucherId, voucherNumber }) {
  const existing = loadBrowserBusinessVoucherSource(kind, id);
  if (!existing) throw new Error("未找到业务来源记录");
  if (sourceVoucherId(existing)) throw new Error("业务来源已关联凭证");
  const linked = {
    ...existing,
    voucherId,
    voucherNumber,
    status: "已生成凭证",
    updatedAt: new Date().toISOString(),
  };
  if (kind === "cost_carryover") {
    const records = readStorage(COST_CARRYOVER_STORAGE_KEY, []);
    writeStorage(
      COST_CARRYOVER_STORAGE_KEY,
      records.map((record) => (record?.id === id ? { ...linked, voucherNo: voucherNumber } : record)),
    );
  } else if (kind === "account_transfer") {
    const records = readStorage(TRANSFER_STORAGE_KEY, []);
    writeStorage(
      TRANSFER_STORAGE_KEY,
      records.map((record) => (record?.id === id ? linked : record)),
    );
  } else {
    const data = readStorage(BUSINESS_STORAGE_KEY, {
      documentRecords: [],
      businessOrders: [],
    });
    const key = kind === "document_record" ? "documentRecords" : "businessOrders";
    writeStorage(BUSINESS_STORAGE_KEY, {
      ...data,
      [key]: (Array.isArray(data[key]) ? data[key] : []).map((record) =>
        record?.id === id ? linked : record,
      ),
    });
  }
  return linked;
}

export function unlinkBrowserBusinessVoucherSources(voucherId) {
  const normalizedVoucherId = text(voucherId);
  if (!normalizedVoucherId || typeof window === "undefined") return;
  const unlink = (record, fallbackStatus = "待确认") =>
    sourceVoucherId(record) === normalizedVoucherId
      ? {
          ...record,
          voucherId: null,
          voucherNumber: null,
          status: fallbackStatus,
          updatedAt: new Date().toISOString(),
        }
      : record;
  const data = readStorage(BUSINESS_STORAGE_KEY, {
    documentRecords: [],
    businessOrders: [],
  });
  writeStorage(BUSINESS_STORAGE_KEY, {
    ...data,
    documentRecords: (data.documentRecords || []).map((record) => unlink(record, "待审核")),
    businessOrders: (data.businessOrders || []).map((record) => unlink(record)),
  });
  const transfers = readStorage(TRANSFER_STORAGE_KEY, []);
  writeStorage(TRANSFER_STORAGE_KEY, Array.isArray(transfers) ? transfers.map(unlink) : []);
  const carryovers = readStorage(COST_CARRYOVER_STORAGE_KEY, []);
  writeStorage(
    COST_CARRYOVER_STORAGE_KEY,
    Array.isArray(carryovers)
      ? carryovers.map((record) => {
          const unlinked = unlink(record);
          return unlinked === record ? record : { ...unlinked, voucherNo: null };
        })
      : [],
  );
}

export function linkBrowserDepreciationVoucher({
  batches,
  lines,
  companyId,
  period,
  voucherId,
  voucherNumber,
  now = new Date().toISOString(),
}) {
  const scopedCompanyId = text(companyId);
  const scopedPeriod = text(period);
  const scopedVoucherId = text(voucherId);
  const linkedBatch = (Array.isArray(batches) ? batches : []).find(
    (item) =>
      text(item?.companyId) === scopedCompanyId &&
      text(item?.period) === scopedPeriod,
  );
  const linkedLines = (Array.isArray(lines) ? lines : []).filter(
    (item) =>
      text(item?.companyId) === scopedCompanyId &&
      text(item?.period) === scopedPeriod,
  );
  if (!linkedBatch || linkedLines.length === 0 || !scopedVoucherId) {
    throw new Error("折旧批次、折旧明细或凭证标识无效");
  }
  return {
    batches: batches.map((item) =>
      item === linkedBatch
        ? {
            ...item,
            voucherId: scopedVoucherId,
            voucherNumber: text(voucherNumber) || null,
            status: "已生成凭证",
            updatedAt: now,
          }
        : item,
    ),
    lines: lines.map((item) =>
      linkedLines.includes(item)
        ? {
            ...item,
            voucherId: scopedVoucherId,
            status: "已生成凭证",
            updatedAt: now,
          }
        : item,
    ),
  };
}

export function unlinkBrowserDepreciationVoucher({
  batches,
  lines,
  companyId,
  voucherId,
  now = new Date().toISOString(),
}) {
  const scopedCompanyId = text(companyId);
  const scopedVoucherId = text(voucherId);
  const matches = (item) =>
    text(item?.companyId) === scopedCompanyId &&
    text(item?.voucherId) === scopedVoucherId;
  const unlink = (item, includeNumber = false) =>
    matches(item)
      ? {
          ...item,
          voucherId: null,
          ...(includeNumber ? { voucherNumber: null } : {}),
          status: "待复核",
          updatedAt: now,
        }
      : item;
  return {
    batches: (Array.isArray(batches) ? batches : []).map((item) =>
      unlink(item, true),
    ),
    lines: (Array.isArray(lines) ? lines : []).map((item) => unlink(item)),
  };
}
