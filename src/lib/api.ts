/**
 * Tauri API wrapper - connects to actual Rust backend via invoke()
 */

import { invoke } from "./tauri";
import { normalizeInvoiceRecord } from "./invoiceRecord.js";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApiMeta {
  total: number;
  page: number;
  limit: number;
}

export interface LocalBackupSnapshot {
  id: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
}

export interface LocalBackupVerification {
  id: string;
  fileName: string;
  valid: boolean;
  message: string;
}

export interface LocalBackupExport {
  backupId: string;
  fileName: string;
  sizeBytes: number;
  message: string;
}

export interface LocalBackupRestoreSchedule {
  backupId: string;
  safetyBackupId: string;
  scheduledAt: string;
  restartRequired: boolean;
  message: string;
}

export interface ReportSnapshot {
  id: string;
  companyId: string;
  periodId: string;
  reportType: string;
  version: number;
  templateId: string | null;
  templateName: string;
  snapshotJson: string;
  sourceFingerprint: string;
  templateFingerprint: string | null;
  generatedBy: string;
  generatedAt: string;
  publishedAt: string;
}

interface RawReportSnapshot {
  id: string;
  company_id: string;
  period_id: string;
  report_type: string;
  version: number;
  template_id: string | null;
  template_name: string;
  snapshot_json: string;
  source_fingerprint: string;
  template_fingerprint: string | null;
  generated_by: string;
  generated_at: string;
  published_at: string;
}

function mapReportSnapshot(snapshot: RawReportSnapshot): ReportSnapshot {
  return {
    id: snapshot.id,
    companyId: snapshot.company_id,
    periodId: snapshot.period_id,
    reportType: snapshot.report_type,
    version: snapshot.version,
    templateId: snapshot.template_id,
    templateName: snapshot.template_name,
    snapshotJson: snapshot.snapshot_json,
    sourceFingerprint: snapshot.source_fingerprint,
    templateFingerprint: snapshot.template_fingerprint,
    generatedBy: snapshot.generated_by,
    generatedAt: snapshot.generated_at,
    publishedAt: snapshot.published_at,
  };
}

export interface Employee {
  id: string;
  companyId: string;
  employeeCode: string;
  name: string;
  idNo: string | null;
  department: string | null;
  position: string | null;
  mobile: string | null;
  entryDate: string | null;
  employmentStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  period: string;
  baseSalary: number;
  bonus: number;
  taxAmount: number;
  socialPersonal: number;
  netSalary: number;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface SocialSecurityRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  period: string;
  city: string | null;
  contributionBase: number;
  companyAmount: number;
  personalAmount: number;
  fundAmount: number;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface SpecialDeductionRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  deductionType: string;
  startMonth: string;
  endMonth: string | null;
  monthlyAmount: number;
  source: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface BankTransaction {
  id: string;
  companyId: string;
  period: string;
  accountName: string;
  serialNo: string;
  transactionDate: string;
  counterparty: string | null;
  summary: string | null;
  incomeAmount: number;
  expenseAmount: number;
  balance: number | null;
  receiptStatus: string;
  matchResult: string | null;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface DocumentRecord {
  id: string;
  companyId: string;
  period: string;
  businessDate: string;
  documentCode: string;
  businessType: string;
  partner: string | null;
  amount: number;
  owner: string | null;
  attachmentStatus: string;
  stampTaxItem: string | null;
  stampTaxRate: number | null;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface BusinessOrder {
  id: string;
  companyId: string;
  period: string;
  orderType: "purchase" | "sales";
  orderNo: string;
  businessDate: string;
  counterparty: string;
  goodsName: string;
  amount: number;
  fulfillmentStatus: string;
  invoiceStatus: string;
  settlementStatus: string;
  status: string;
  sourceDocument: string | null;
  voucherId: string | null;
  voucherNumber: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SettlementRecord {
  id: string;
  companyId: string;
  period: string;
  settlementType: "receivable" | "payable";
  settlementNo: string;
  settlementDate: string;
  counterparty: string;
  invoiceNo: string | null;
  transactionNo: string | null;
  totalAmount: number;
  settledAmount: number;
  balanceAmount: number;
  settlementMethod: string;
  owner: string | null;
  status: string;
  sourceDocument: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface BankReconciliationRecord {
  id: string;
  companyId: string;
  period: string;
  reconciliationNo: string;
  reconciliationDate: string;
  bankTransactionId: string | null;
  accountName: string;
  transactionNo: string;
  summary: string | null;
  bankAmount: number;
  bookAmount: number;
  differenceAmount: number;
  voucherNo: string | null;
  matchStatus: string;
  owner: string | null;
  status: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface CostCarryoverRecord {
  id: string;
  companyId: string;
  period: string;
  batchNo: string;
  carryoverDate: string;
  valuationMethod: string;
  sourceBillNo: string;
  inventoryName: string;
  debitSubject: string;
  creditSubject: string;
  costAmount: number;
  differenceAmount: number;
  voucherId: string | null;
  voucherNo: string | null;
  status: string;
  sourceDocument: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface AccountTransfer {
  id: string;
  companyId: string;
  period: string;
  transferDate: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  fee: number;
  serialNo: string | null;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface FixedAsset {
  id: string;
  companyId: string;
  period: string;
  assetCode: string;
  assetName: string;
  category: string;
  categoryId: string | null;
  startDate: string;
  originalValue: number;
  usefulLifeMonths: number;
  residualRate: number;
  depreciationMethod: string;
  assetAccount: string;
  accumulatedDepreciationAccount: string;
  expenseAccount: string | null;
  openingAccumulatedDepreciation: number;
  openingDepreciationMonths: number;
  sourceDocument: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface DepreciationBatch {
  id: string;
  companyId: string;
  period: string;
  assetCount: number;
  depreciationAmount: number;
  voucherId: string | null;
  voucherNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface FixedAssetDepreciationLine {
  id: string;
  batchId: string;
  companyId: string;
  period: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  category: string;
  depreciationMethod: string;
  expenseAccount: string;
  accumulatedDepreciationAccount: string;
  depreciableAmount: number;
  monthsDepreciated: number;
  openingAccumulatedDepreciation: number;
  depreciationAmount: number;
  closingAccumulatedDepreciation: number;
  closingNetValue: number;
  voucherId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryMovement {
  id: string;
  companyId: string;
  period: string;
  movementDate: string;
  billNo: string;
  movementType: string;
  inventoryName: string;
  warehouse: string;
  counterparty: string | null;
  unit: string;
  quantity: number;
  amount: number;
  inventoryItemId: string | null;
  warehouseId: string | null;
  direction: "inbound" | "outbound" | null;
  unitCost: number;
  confirmedAt: string | null;
  sourceDocument: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryItem {
  id: string;
  companyId: string;
  itemCode: string;
  itemName: string;
  specification: string | null;
  unit: string;
  unitId: string | null;
  taxRate: number | null;
  defaultSubject: string | null;
  category: string | null;
  categoryId: string | null;
  valuationMethod: string;
  inventorySubject: string;
  costSubject: string;
  safetyStock: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryCategory {
  id: string;
  companyId: string;
  categoryCode: string;
  categoryName: string;
  inventorySubject: string;
  costSubject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryWarehouse {
  id: string;
  companyId: string;
  warehouseCode: string;
  warehouseName: string;
  location: string | null;
  manager: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryBomLine {
  id: string;
  bomId: string;
  companyId: string;
  componentItemId: string;
  componentItemCode: string;
  componentItemName: string;
  componentSpecification: string | null;
  componentUnit: string;
  quantity: number;
  lossRate: number;
  sortOrder: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryBom {
  id: string;
  companyId: string;
  bomCode: string;
  bomName: string;
  version: string;
  parentItemId: string;
  parentItemCode: string;
  parentItemName: string;
  parentSpecification: string | null;
  parentUnit: string;
  effectiveDate: string;
  expirationDate: string | null;
  status: string;
  note: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  lines: InventoryBomLine[];
}
export interface InventoryStockBalance {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  warehouse: string;
  unit: string;
  quantity: number;
  amount: number;
  averageUnitCost: number;
  safetyStock: number;
}
export interface InventoryOpeningBalance {
  id: string;
  companyId: string;
  periodId: string;
  period: string;
  inventoryItemId: string;
  warehouseId: string;
  itemCode: string;
  itemName: string;
  warehouseName: string;
  unit: string;
  inventorySubject: string;
  quantity: number;
  amount: number;
  status: string;
  movementId: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryOpeningReconciliation {
  detailAmount: number;
  ledgerAmount: number;
  differenceAmount: number;
  isReconciled: boolean;
  financialOpeningFinalized: boolean;
  inventoryOpeningFinalized: boolean;
  message: string;
}
export interface InventoryStocktake {
  id: string;
  companyId: string;
  periodId: string;
  period: string;
  stocktakeNo: string;
  stocktakeDate: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  note: string | null;
  sourceMovementMaxRowid: number;
  voucherId: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface InventoryStocktakeLine {
  id: string;
  stocktakeId: string;
  companyId: string;
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  inventorySubject: string;
  bookQuantity: number;
  bookAmount: number;
  bookUnitCost: number;
  actualQuantity: number | null;
  actualUnitCost: number | null;
  varianceQuantity: number;
  varianceAmount: number;
  reason: string | null;
  movementId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface MeasurementUnit {
  id: string;
  companyId: string;
  unitName: string;
  unitGroup: string | null;
  baseUnit: string | null;
  conversionRate: number;
  precisionDigits: number;
  remark: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T> {
  meta?: ApiMeta;
}

// ============================================
// Types (camelCase to match frontend stores)
// ============================================
export interface User {
  id: string;
  username: string;
  realName: string;
  role: string;
}

export interface Company {
  id: string;
  name: string;
  accountingSystem: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyMemoRecord {
  id: string;
  companyId: string;
  content: string;
  reminderDate: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyTodo {
  id: string;
  companyId: string;
  companyName: string | null;
  period: string | null;
  title: string;
  sourceModule: string;
  priority: "normal" | "high" | "blocking";
  owner: string | null;
  dueDate: string | null;
  relatedEntry: string | null;
  evidence: string | null;
  note: string | null;
  status: "open" | "review" | "blocked" | "completed";
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  code: string;
  name: string;
  type: string;
  level: number;
  parentCode: string | null;
}

export interface Voucher {
  id: string;
  companyId: string | null;
  number: string;
  date: string;
  summary: string | null;
  amount: number;
  status: "draft" | "approved" | "posted" | "reversed";
  attachmentCount: number;
  createdBy: string | null;
  createdAt: string | null;
  modifiedBy: string | null;
  modifiedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  entries?: VoucherEntry[];
}

export interface VoucherEntry {
  id: string;
  voucherId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  summary: string | null;
  entryIndex: number;
}

export interface VoucherWithEntries extends Voucher {
  entries: VoucherEntry[];
}

export interface Invoice {
  id: string;
  companyId: string | null;
  periodId: string | null;
  invoiceType: "input" | "output";
  invoiceNo: string;
  invoiceCode: string | null;
  invoiceDate: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number | null;
  sellerName: string | null;
  sellerTaxId: string | null;
  buyerName: string | null;
  buyerTaxId: string | null;
  status: "pending" | "verified" | "matched" | "rejected";
  voucherId: string | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  companyId: string;
  lineNo: number;
  itemName: string;
  specification: string | null;
  unit: string | null;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  taxRate: number | null;
  taxAmount: number;
  taxClassificationCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineInput {
  itemName: string;
  specification?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  taxRate?: number;
  taxAmount: number;
  taxClassificationCode?: string;
}

export type InvoiceTaxEventType =
  | "certification_review_passed"
  | "deduction_declared"
  | "deduction_transferred_out"
  | "not_deductible";

export interface InvoiceTaxEvent {
  id: string;
  invoiceId: string;
  companyId: string;
  eventType: InvoiceTaxEventType;
  deductionPeriod: string | null;
  deductibleTaxAmount: number;
  source: string;
  referenceNo: string | null;
  remarks: string | null;
  operator: string;
  occurredAt: string;
}

function normalizeInvoiceLine(record: Record<string, unknown>): InvoiceLine {
  return {
    id: String(record.id),
    invoiceId: String(record.invoice_id),
    companyId: String(record.company_id),
    lineNo: Number(record.line_no),
    itemName: String(record.item_name),
    specification:
      record.specification == null ? null : String(record.specification),
    unit: record.unit == null ? null : String(record.unit),
    quantity: record.quantity == null ? null : Number(record.quantity),
    unitPrice: record.unit_price == null ? null : Number(record.unit_price),
    amount: Number(record.amount),
    taxRate: record.tax_rate == null ? null : Number(record.tax_rate),
    taxAmount: Number(record.tax_amount),
    taxClassificationCode:
      record.tax_classification_code == null
        ? null
        : String(record.tax_classification_code),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at),
  };
}

function normalizeInvoiceTaxEvent(
  record: Record<string, unknown>,
): InvoiceTaxEvent {
  return {
    id: String(record.id),
    invoiceId: String(record.invoice_id),
    companyId: String(record.company_id),
    eventType: String(record.event_type) as InvoiceTaxEventType,
    deductionPeriod:
      record.deduction_period == null ? null : String(record.deduction_period),
    deductibleTaxAmount: Number(record.deductible_tax_amount),
    source: String(record.source),
    referenceNo:
      record.reference_no == null ? null : String(record.reference_no),
    remarks: record.remarks == null ? null : String(record.remarks),
    operator: String(record.operator),
    occurredAt: String(record.occurred_at),
  };
}

export interface AgencyServiceContract {
  id: string;
  companyId: string;
  companyName: string | null;
  contractNo: string;
  servicePackage: string;
  serviceStart: string;
  serviceEnd: string;
  monthlyFee: number;
  renewalStatus: string;
  owner: string | null;
  archiveStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyFeeCollection {
  id: string;
  companyId: string;
  companyName: string | null;
  period: string;
  receivableAmount: number;
  receivedAmount: number;
  arrearsAmount: number;
  invoiceStatus: string;
  paymentStatus: string;
  collector: string | null;
  lastFollowUp: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyCollaborationItem {
  id: string;
  companyId: string;
  companyName: string | null;
  todoTitle: string;
  materialType: string | null;
  customerContact: string | null;
  reminderCount: number;
  lastContactAt: string | null;
  replyStatus: string;
  owner: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyDeliveryTicket {
  id: string;
  companyId: string;
  companyName: string | null;
  ticketNo: string;
  taskName: string;
  period: string;
  currentStage: string;
  slaStatus: string;
  owner: string | null;
  deliveryStatus: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyBatchTask {
  id: string;
  taskType: string;
  taskName: string;
  period: string;
  customerScope: string;
  status: string;
  progressCurrent: number;
  progressTotal: number | null;
  resultSummary: string | null;
  riskLevel: string;
  operator: string | null;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyBatchTaskItem {
  id: string;
  taskId: string;
  companyId: string;
  companyName: string | null;
  periodId: string | null;
  action: string;
  status: string;
  resultSummary: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyHealthCheckItem {
  id: string;
  companyId: string;
  companyName: string | null;
  moduleName: string;
  riskMessage: string;
  riskLevel: string;
  owner: string | null;
  resolutionStatus: string;
}

export interface AgencyOperationOverview {
  serviceContracts: number;
  expiringContracts: number;
  receivableAmount: number;
  arrearsAmount: number;
  pendingCollaboration: number;
  overdueCollaboration: number;
  openTickets: number;
  blockedTickets: number;
}

export interface AgencyCompanyProgress {
  companyId: string;
  period: string;
  invoiceCount: number;
  invoicePendingCount: number;
  voucherCount: number;
  approvedVoucherCount: number;
  taxTaskCount: number;
  collectedTaxTaskCount: number;
  declaredTaxTaskCount: number;
  paidTaxTaskCount: number;
  riskCount: number;
  latestActivityAt: string | null;
}

export interface AutomationJob {
  id: string;
  companyId: string;
  companyName: string | null;
  period: string | null;
  jobType: string;
  sourceModule: string;
  sourceId: string | null;
  sourceFile: string | null;
  suggestionNo: string | null;
  debitSubject: string | null;
  creditSubject: string | null;
  suggestionAmount: number | null;
  generatedVoucherId: string | null;
  generatedVoucherNumber: string | null;
  status: string;
  confidence: number | null;
  resultSummary: string | null;
  riskLevel: string;
  reviewer: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderConfig {
  id: string;
  companyId: string;
  providerName: string;
  providerType: string;
  endpoint: string;
  model: string;
  credentialEnv: string;
  timeoutSeconds: number;
  maxFileBytes: number;
  isEnabled: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDeclarationTask {
  id: string;
  companyId: string;
  companyName: string | null;
  period: string;
  taxType: string;
  formName: string;
  collectStatus: string;
  validationStatus: string;
  declarationStatus: string;
  sourceSnapshot: string | null;
  taxableAmount: number;
  deductionAmount: number;
  payableAmount: number;
  riskCount: number;
  adapterCode: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  receiptNo: string | null;
  paymentStatus: string;
  paymentNo: string | null;
  receiptReceivedAt: string | null;
  snapshotVersion: number;
  snapshotFingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalInvoiceSyncItem {
  id: string;
  batchId: string;
  companyId: string;
  externalInvoiceId: string;
  invoiceType: string;
  invoiceCode: string | null;
  invoiceNo: string;
  invoiceDate: string;
  sellerName: string | null;
  sellerTaxId: string | null;
  buyerName: string | null;
  buyerTaxId: string | null;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number | null;
  currency: string;
  reviewStatus: string;
  duplicateInvoiceId: string | null;
  payloadChecksum: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  importedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalInvoiceSyncResult {
  batchId: string;
  stagedCount: number;
  duplicateCount: number;
  nextCursor: string | null;
}

export interface ExternalBankSyncItem {
  id: string;
  batchId: string;
  companyId: string;
  externalTransactionId: string;
  accountMask: string;
  transactionDate: string;
  valueDate: string | null;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  counterpartyName: string | null;
  counterpartyAccountMask: string | null;
  bankReference: string | null;
  summary: string | null;
  balance: number | null;
  reviewStatus: string;
  duplicateTransactionId: string | null;
  payloadChecksum: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  importedTransactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalBankSyncResult {
  batchId: string;
  stagedCount: number;
  duplicateCount: number;
  nextCursor: string | null;
}

export interface TaxDeadlineRule {
  id: string;
  companyId: string;
  taxType: string;
  filingFrequency: string;
  dueMonthOffset: number;
  dueDay: number;
  adjustmentPolicy: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceName: string;
  sourceUrl: string | null;
  isActive: boolean;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxCalendarDay {
  id: string;
  companyId: string;
  calendarDate: string;
  dayType: string;
  reason: string;
  sourceName: string;
  sourceUrl: string | null;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDeclarationSchedule {
  taskId: string;
  taxType: string;
  formName: string;
  period: string;
  dueDate: string | null;
  ruleId: string | null;
  filingFrequency: string | null;
  calculationBasis: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  configurationStatus: string;
}

export interface AdapterAuthorization {
  id: string;
  companyId: string;
  companyName: string | null;
  adapterType: string;
  adapterCode: string;
  region: string | null;
  authStatus: string;
  accountMask: string | null;
  loginIdentity: string | null;
  capabilityScope: string | null;
  lastCheckedAt: string | null;
  expiresAt: string | null;
  riskMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdapterProviderConfig {
  id: string;
  companyId: string;
  authorizationId: string;
  providerName: string;
  endpoint: string;
  credentialEnv: string;
  timeoutSeconds: number;
  isEnabled: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface OperationAuditLog {
  id: string;
  companyId: string | null;
  companyName: string | null;
  moduleName: string;
  action: string;
  objectRef: string | null;
  riskLevel: string;
  result: string;
  detail: string | null;
  operator: string | null;
  createdAt: string;
}

// ============================================
// Auth API
// ============================================
export const authApi = {
  login: async (
    username: string,
    password: string,
  ): Promise<ApiResponse<{ token: string; user: User }>> => {
    try {
      const result = (await invoke("login", {
        request: { username, password },
      })) as { success: boolean; token?: string; user?: User; error?: string };
      if (result.success && result.user) {
        return {
          success: true,
          data: { token: result.token!, user: result.user },
        };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  logout: async (): Promise<ApiResponse<void>> => {
    try {
      await invoke("logout");
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  checkAuth: async (): Promise<
    ApiResponse<{ isAuthenticated: boolean; user?: User }>
  > => {
    try {
      const result = (await invoke("check", { token: null })) as {
        is_authenticated: boolean;
        user?: User;
      };
      return {
        success: true,
        data: { isAuthenticated: result.is_authenticated, user: result.user },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

// ============================================
// Company API (账套)
// ============================================
export const companyApi = {
  getAll: async (): Promise<ApiResponse<Company[]>> => {
    try {
      const result = (await invoke("get_companies")) as Company[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  get: async (id: string): Promise<ApiResponse<Company | null>> => {
    try {
      const result = (await invoke("get_company", { id })) as Company | null;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  create: async (company: {
    name: string;
    accountingSystem?: string;
  }): Promise<ApiResponse<Company>> => {
    try {
      const input = {
        name: company.name,
        accounting_system: company.accountingSystem,
      };
      const result = (await invoke("create_company", { input })) as Company;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  update: async (
    id: string,
    company: { name: string; accountingSystem?: string },
  ): Promise<ApiResponse<Company>> => {
    try {
      const input = {
        name: company.name,
        accounting_system: company.accountingSystem,
      };
      const result = (await invoke("update_company", { id, input })) as Company;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      await invoke("delete_company", { id });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const companyMemoApi = {
  getAll: async (): Promise<ApiResponse<CompanyMemoRecord[]>> => {
    try {
      const result = (await invoke("get_company_memos")) as CompanyMemoRecord[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsert: async (input: {
    companyId: string;
    content: string;
    reminderDate?: string;
  }): Promise<ApiResponse<CompanyMemoRecord>> => {
    try {
      const result = (await invoke("upsert_company_memo", {
        input: {
          company_id: input.companyId,
          content: input.content,
          reminder_date: input.reminderDate || null,
        },
      })) as CompanyMemoRecord;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const companyTodoApi = {
  getAll: async (filters: {
    companyId: string;
    period?: string;
    status?: string;
  }): Promise<ApiResponse<CompanyTodo[]>> => {
    try {
      const result = (await invoke(
        "get_company_todos",
        filters,
      )) as CompanyTodo[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  create: async (input: {
    companyId: string;
    period?: string;
    title: string;
    sourceModule: string;
    priority?: CompanyTodo["priority"];
    owner?: string;
    dueDate?: string;
    relatedEntry?: string;
    evidence?: string;
    note?: string;
  }): Promise<ApiResponse<CompanyTodo>> => {
    try {
      const result = (await invoke("create_company_todo", {
        input: {
          company_id: input.companyId,
          period: input.period || null,
          title: input.title,
          source_module: input.sourceModule,
          priority: input.priority || "normal",
          owner: input.owner || null,
          due_date: input.dueDate || null,
          related_entry: input.relatedEntry || null,
          evidence: input.evidence || null,
          note: input.note || null,
        },
      })) as CompanyTodo;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  complete: async (input: {
    id: string;
    companyId: string;
    note?: string;
  }): Promise<ApiResponse<CompanyTodo>> => {
    try {
      const result = (await invoke("complete_company_todo", {
        input: {
          id: input.id,
          company_id: input.companyId,
          note: input.note || null,
        },
      })) as CompanyTodo;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

// ============================================
// Subject API (会计科目)
// ============================================
export const subjectApi = {
  getAll: async (companyId: string): Promise<ApiResponse<Subject[]>> => {
    try {
      const result = (await invoke("get_subjects", { companyId })) as Subject[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  get: async (
    code: string,
    companyId: string,
  ): Promise<ApiResponse<Subject | null>> => {
    try {
      const result = (await invoke("get_subject", {
        code,
        companyId,
      })) as Subject | null;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getByType: async (
    type: string,
    companyId: string,
  ): Promise<ApiResponse<Subject[]>> => {
    try {
      const result = (await invoke("get_subjects_by_type", {
        type_: type,
        companyId,
      })) as Subject[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  create: async (
    subject: {
      code: string;
      name: string;
      type: string;
      level: number;
      parentCode?: string;
    },
    companyId: string,
  ): Promise<ApiResponse<Subject>> => {
    try {
      const input = {
        code: subject.code,
        name: subject.name,
        type_: subject.type,
        level: subject.level,
        parent_code: subject.parentCode,
        company_id: companyId,
      };
      const result = (await invoke("create_subject", { input })) as Subject;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  update: async (
    code: string,
    subject: {
      code: string;
      name: string;
      type: string;
      level: number;
      parentCode?: string;
    },
    companyId: string,
  ): Promise<ApiResponse<Subject>> => {
    try {
      const input = {
        code: subject.code,
        name: subject.name,
        type_: subject.type,
        level: subject.level,
        parent_code: subject.parentCode,
        company_id: companyId,
      };
      const result = (await invoke("update_subject", {
        code,
        companyId,
        input,
      })) as Subject;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  delete: async (
    code: string,
    companyId: string,
  ): Promise<ApiResponse<void>> => {
    try {
      await invoke("delete_subject", { code, companyId });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  search: async (
    keyword: string,
    companyId: string,
  ): Promise<ApiResponse<Subject[]>> => {
    try {
      const result = (await invoke("search_subjects", {
        keyword,
        companyId,
      })) as Subject[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

// ============================================
// Voucher API (会计凭证)
// ============================================
export const voucherApi = {
  getAll: async (companyId?: string): Promise<ApiResponse<Voucher[]>> => {
    try {
      const result = (await invoke("get_vouchers", { companyId })) as Voucher[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  get: async (id: string): Promise<ApiResponse<VoucherWithEntries | null>> => {
    try {
      const result = (await invoke("get_voucher", {
        id,
      })) as VoucherWithEntries | null;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  create: async (voucher: {
    companyId?: string;
    number: string;
    date: string;
    summary?: string;
    amount: number;
    status?: string;
    attachmentCount?: number;
    entries: Array<{
      accountCode: string;
      accountName: string;
      debit?: number;
      credit?: number;
      summary?: string;
    }>;
  }): Promise<ApiResponse<VoucherWithEntries>> => {
    try {
      const input = {
        account_id: voucher.companyId,
        number: voucher.number,
        date: voucher.date,
        summary: voucher.summary,
        amount: voucher.amount,
        status: voucher.status,
        attachment_count: voucher.attachmentCount,
        entries: voucher.entries.map((e, i) => ({
          account_code: e.accountCode,
          account_name: e.accountName,
          debit: e.debit ?? 0,
          credit: e.credit ?? 0,
          entry_summary: e.summary,
          entry_index: i,
        })),
      };
      const result = (await invoke("create_voucher", {
        input,
      })) as VoucherWithEntries;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  update: async (
    id: string,
    voucher: {
      number?: string;
      date?: string;
      summary?: string;
      amount?: number;
      status?: string;
      attachmentCount?: number;
      entries?: Array<{
        accountCode: string;
        accountName: string;
        debit?: number;
        credit?: number;
        summary?: string;
      }>;
    },
  ): Promise<ApiResponse<VoucherWithEntries>> => {
    try {
      const input: Record<string, unknown> = {};
      if (voucher.number !== undefined) input.number = voucher.number;
      if (voucher.date !== undefined) input.date = voucher.date;
      if (voucher.summary !== undefined) input.summary = voucher.summary;
      if (voucher.amount !== undefined) input.amount = voucher.amount;
      if (voucher.status !== undefined) input.status = voucher.status;
      if (voucher.attachmentCount !== undefined)
        input.attachment_count = voucher.attachmentCount;
      if (voucher.entries) {
        input.entries = voucher.entries.map((e) => ({
          account_code: e.accountCode,
          account_name: e.accountName,
          debit: e.debit ?? 0,
          credit: e.credit ?? 0,
          entry_summary: e.summary,
        }));
      }
      const result = (await invoke("update_voucher", {
        id,
        input,
        companyId: undefined,
      })) as VoucherWithEntries;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    try {
      await invoke("delete_voucher", { id });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  approve: async (
    id: string,
    companyId: string,
  ): Promise<ApiResponse<Voucher>> => {
    try {
      const result = (await invoke("approve_voucher", {
        id,
        companyId,
      })) as Voucher;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  reverseApprove: async (
    id: string,
    companyId: string,
  ): Promise<ApiResponse<Voucher>> => {
    try {
      const result = (await invoke("reverse_approve_voucher", {
        id,
        companyId,
      })) as Voucher;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  reverse: async (
    id: string,
    companyId: string,
  ): Promise<ApiResponse<Voucher>> => {
    try {
      const result = (await invoke("reverse_voucher", {
        id,
        companyId,
      })) as Voucher;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  copy: async (id: string): Promise<ApiResponse<VoucherWithEntries>> => {
    try {
      const result = (await invoke("copy_voucher", {
        id,
      })) as VoucherWithEntries;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getEntries: async (
    voucherId: string,
  ): Promise<ApiResponse<VoucherEntry[]>> => {
    try {
      const result = (await invoke("get_voucher_entries", {
        voucherId,
      })) as VoucherEntry[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  reorganizeNumbers: async (
    periodId: string,
    companyId: string,
  ): Promise<ApiResponse<void>> => {
    try {
      await invoke("reorganize_voucher_numbers", { periodId, companyId });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  batchApprove: async (
    ids: string[],
    companyId: string,
  ): Promise<ApiResponse<void>> => {
    try {
      await invoke("batch_approve_vouchers", { ids, companyId });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  batchReverseApprove: async (
    ids: string[],
    companyId: string,
  ): Promise<ApiResponse<void>> => {
    try {
      await invoke("batch_reverse_approve_vouchers", { ids, companyId });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

// ============================================
// Invoice API (发票)
// ============================================
export const invoiceApi = {
  getAll: async (
    companyId?: string,
    invoiceType?: string,
    periodId?: string,
  ): Promise<ApiResponse<Invoice[]>> => {
    try {
      const result = (await invoke("get_invoices", {
        companyId,
        invoiceType,
        periodId,
      })) as Record<string, unknown>[];
      return {
        success: true,
        data: result.map(
          (invoice) => normalizeInvoiceRecord(invoice) as Invoice,
        ),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  get: async (
    id: string,
    companyId: string,
  ): Promise<ApiResponse<Invoice | null>> => {
    try {
      const result = (await invoke("get_invoice", { id, companyId })) as Record<
        string,
        unknown
      > | null;
      return {
        success: true,
        data: result ? (normalizeInvoiceRecord(result) as Invoice) : null,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  create: async (invoice: {
    companyId?: string;
    periodId?: string;
    invoiceType: "input" | "output";
    invoiceNo: string;
    invoiceCode?: string;
    invoiceDate: string;
    amount: number;
    taxAmount: number;
    taxRate?: number;
    sellerName?: string;
    sellerTaxId?: string;
    buyerName?: string;
    buyerTaxId?: string;
    remarks?: string;
    lines: InvoiceLineInput[];
  }): Promise<ApiResponse<Invoice>> => {
    try {
      const input = {
        company_id: invoice.companyId,
        period_id: invoice.periodId,
        invoice_type: invoice.invoiceType,
        invoice_no: invoice.invoiceNo,
        invoice_code: invoice.invoiceCode,
        invoice_date: invoice.invoiceDate,
        amount: invoice.amount,
        tax_amount: invoice.taxAmount,
        tax_rate: invoice.taxRate,
        seller_name: invoice.sellerName,
        seller_tax_id: invoice.sellerTaxId,
        buyer_name: invoice.buyerName,
        buyer_tax_id: invoice.buyerTaxId,
        remarks: invoice.remarks,
        lines: invoice.lines.map((line) => ({
          item_name: line.itemName,
          specification: line.specification,
          unit: line.unit,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          amount: line.amount,
          tax_rate: line.taxRate,
          tax_amount: line.taxAmount,
          tax_classification_code: line.taxClassificationCode,
        })),
      };
      const result = (await invoke("create_invoice", { input })) as Record<
        string,
        unknown
      >;
      return { success: true, data: normalizeInvoiceRecord(result) as Invoice };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  updateWithLines: async (
    id: string,
    invoice: {
      companyId: string;
      periodId?: string;
      invoiceType?: string;
      invoiceNo?: string;
      invoiceCode?: string;
      invoiceDate?: string;
      amount?: number;
      taxAmount?: number;
      taxRate?: number;
      sellerName?: string;
      sellerTaxId?: string;
      buyerName?: string;
      buyerTaxId?: string;
      remarks?: string;
    },
    lines: InvoiceLineInput[],
  ): Promise<ApiResponse<Invoice>> => {
    try {
      const input: Record<string, unknown> = { company_id: invoice.companyId };
      if (invoice.periodId) input.period_id = invoice.periodId;
      if (invoice.invoiceType) input.invoice_type = invoice.invoiceType;
      if (invoice.invoiceNo) input.invoice_no = invoice.invoiceNo;
      if (invoice.invoiceCode) input.invoice_code = invoice.invoiceCode;
      if (invoice.invoiceDate) input.invoice_date = invoice.invoiceDate;
      if (invoice.amount !== undefined) input.amount = invoice.amount;
      if (invoice.taxAmount !== undefined) input.tax_amount = invoice.taxAmount;
      if (invoice.taxRate !== undefined) input.tax_rate = invoice.taxRate;
      if (invoice.sellerName) input.seller_name = invoice.sellerName;
      if (invoice.sellerTaxId) input.seller_tax_id = invoice.sellerTaxId;
      if (invoice.buyerName) input.buyer_name = invoice.buyerName;
      if (invoice.buyerTaxId) input.buyer_tax_id = invoice.buyerTaxId;
      if (invoice.remarks) input.remarks = invoice.remarks;
      const result = (await invoke("update_invoice_with_lines", {
        id,
        input,
        lines: lines.map((line) => ({
          item_name: line.itemName,
          specification: line.specification,
          unit: line.unit,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          amount: line.amount,
          tax_rate: line.taxRate,
          tax_amount: line.taxAmount,
          tax_classification_code: line.taxClassificationCode,
        })),
      })) as Record<string, unknown>;
      return { success: true, data: normalizeInvoiceRecord(result) as Invoice };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  reviewOutput: async (
    invoiceId: string,
    companyId: string,
  ): Promise<ApiResponse<Invoice>> => {
    try {
      const result = (await invoke("review_output_invoice", {
        invoiceId,
        companyId,
      })) as Record<string, unknown>;
      return { success: true, data: normalizeInvoiceRecord(result) as Invoice };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  delete: async (id: string, companyId: string): Promise<ApiResponse<void>> => {
    try {
      await invoke("delete_invoice", { id, companyId });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  matchToVoucher: async (
    invoiceId: string,
    voucherId: string,
    companyId: string,
  ): Promise<ApiResponse<void>> => {
    try {
      await invoke("match_invoice_to_voucher", {
        invoiceId,
        voucherId,
        companyId,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getByVoucher: async (
    voucherId: string,
    companyId: string,
  ): Promise<ApiResponse<Invoice[]>> => {
    try {
      const result = (await invoke("get_invoices_by_voucher", {
        voucherId,
        companyId,
      })) as Record<string, unknown>[];
      return {
        success: true,
        data: result.map(
          (invoice) => normalizeInvoiceRecord(invoice) as Invoice,
        ),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getLines: async (
    invoiceId: string,
    companyId: string,
  ): Promise<ApiResponse<InvoiceLine[]>> => {
    try {
      const result = (await invoke("get_invoice_lines", {
        invoiceId,
        companyId,
      })) as Record<string, unknown>[];
      return { success: true, data: result.map(normalizeInvoiceLine) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  replaceLines: async (
    invoiceId: string,
    companyId: string,
    lines: InvoiceLineInput[],
  ): Promise<ApiResponse<InvoiceLine[]>> => {
    try {
      const result = (await invoke("replace_invoice_lines", {
        invoiceId,
        companyId,
        lines: lines.map((line) => ({
          item_name: line.itemName,
          specification: line.specification,
          unit: line.unit,
          quantity: line.quantity,
          unit_price: line.unitPrice,
          amount: line.amount,
          tax_rate: line.taxRate,
          tax_amount: line.taxAmount,
          tax_classification_code: line.taxClassificationCode,
        })),
      })) as Record<string, unknown>[];
      return { success: true, data: result.map(normalizeInvoiceLine) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getTaxEvents: async (
    invoiceId: string,
    companyId: string,
  ): Promise<ApiResponse<InvoiceTaxEvent[]>> => {
    try {
      const result = (await invoke("get_invoice_tax_events", {
        invoiceId,
        companyId,
      })) as Record<string, unknown>[];
      return { success: true, data: result.map(normalizeInvoiceTaxEvent) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  createTaxEvent: async (
    invoiceId: string,
    companyId: string,
    input: {
      eventType: InvoiceTaxEventType;
      deductionPeriod?: string;
      deductibleTaxAmount: number;
      source: string;
      referenceNo?: string;
      remarks?: string;
    },
  ): Promise<ApiResponse<InvoiceTaxEvent>> => {
    try {
      const result = (await invoke("create_invoice_tax_event", {
        invoiceId,
        companyId,
        input: {
          event_type: input.eventType,
          deduction_period: input.deductionPeriod,
          deductible_tax_amount: input.deductibleTaxAmount,
          source: input.source,
          reference_no: input.referenceNo,
          remarks: input.remarks,
        },
      })) as Record<string, unknown>;
      return { success: true, data: normalizeInvoiceTaxEvent(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

type RawAgencyServiceContract = {
  id: string;
  company_id: string;
  company_name: string | null;
  contract_no: string;
  service_package: string;
  service_start: string;
  service_end: string;
  monthly_fee: number;
  renewal_status: string;
  owner: string | null;
  archive_status: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type RawAgencyFeeCollection = {
  id: string;
  company_id: string;
  company_name: string | null;
  period: string;
  receivable_amount: number;
  received_amount: number;
  arrears_amount: number;
  invoice_status: string;
  payment_status: string;
  collector: string | null;
  last_follow_up: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type RawAgencyCollaborationItem = {
  id: string;
  company_id: string;
  company_name: string | null;
  todo_title: string;
  material_type: string | null;
  customer_contact: string | null;
  reminder_count: number;
  last_contact_at: string | null;
  reply_status: string;
  owner: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type RawAgencyDeliveryTicket = {
  id: string;
  company_id: string;
  company_name: string | null;
  ticket_no: string;
  task_name: string;
  period: string;
  current_stage: string;
  sla_status: string;
  owner: string | null;
  delivery_status: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type RawAgencyBatchTask = {
  id: string;
  task_type: string;
  task_name: string;
  period: string;
  customer_scope: string;
  status: string;
  progress_current: number;
  progress_total: number | null;
  result_summary: string | null;
  risk_level: string;
  operator: string | null;
  requires_approval: number;
  created_at: string;
  updated_at: string;
};

type RawAgencyBatchTaskItem = {
  id: string;
  task_id: string;
  company_id: string;
  company_name: string | null;
  period_id: string | null;
  action: string;
  status: string;
  result_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type RawAgencyHealthCheckItem = {
  id: string;
  company_id: string;
  company_name: string | null;
  module_name: string;
  risk_message: string;
  risk_level: string;
  owner: string | null;
  resolution_status: string;
};

type RawAgencyOperationOverview = {
  service_contracts: number;
  expiring_contracts: number;
  receivable_amount: number;
  arrears_amount: number;
  pending_collaboration: number;
  overdue_collaboration: number;
  open_tickets: number;
  blocked_tickets: number;
};

type RawAgencyCompanyProgress = {
  company_id: string;
  period: string;
  invoice_count: number;
  invoice_pending_count: number;
  voucher_count: number;
  approved_voucher_count: number;
  tax_task_count: number;
  collected_tax_task_count: number;
  declared_tax_task_count: number;
  paid_tax_task_count: number;
  risk_count: number;
  latest_activity_at: string | null;
};

type RawAutomationJob = {
  id: string;
  company_id: string;
  company_name: string | null;
  period: string | null;
  job_type: string;
  source_module: string;
  source_id: string | null;
  source_file: string | null;
  suggestion_no: string | null;
  debit_subject: string | null;
  credit_subject: string | null;
  suggestion_amount: number | null;
  generated_voucher_id: string | null;
  generated_voucher_number: string | null;
  status: string;
  confidence: number | null;
  result_summary: string | null;
  risk_level: string;
  reviewer: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RawAiProviderConfig = {
  id: string;
  company_id: string;
  provider_name: string;
  provider_type: string;
  endpoint: string;
  model: string;
  credential_env: string;
  timeout_seconds: number;
  max_file_bytes: number;
  is_enabled: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type RawTaxDeclarationTask = {
  id: string;
  company_id: string;
  company_name: string | null;
  period: string;
  tax_type: string;
  form_name: string;
  collect_status: string;
  validation_status: string;
  declaration_status: string;
  source_snapshot: string | null;
  taxable_amount: number;
  deduction_amount: number;
  payable_amount: number;
  risk_count: number;
  adapter_code: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  receipt_no: string | null;
  payment_status: string;
  payment_no: string | null;
  receipt_received_at: string | null;
  snapshot_version: number;
  snapshot_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

type RawExternalInvoiceSyncItem = {
  id: string;
  batch_id: string;
  company_id: string;
  external_invoice_id: string;
  invoice_type: string;
  invoice_code: string | null;
  invoice_no: string;
  invoice_date: string;
  seller_name: string | null;
  seller_tax_id: string | null;
  buyer_name: string | null;
  buyer_tax_id: string | null;
  amount: number;
  tax_amount: number;
  total_amount: number;
  tax_rate: number | null;
  currency: string;
  review_status: string;
  duplicate_invoice_id: string | null;
  payload_checksum: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  imported_invoice_id: string | null;
  created_at: string;
  updated_at: string;
};

type RawExternalInvoiceSyncResult = {
  batch_id: string;
  staged_count: number;
  duplicate_count: number;
  next_cursor: string | null;
};

type RawExternalBankSyncItem = {
  id: string;
  batch_id: string;
  company_id: string;
  external_transaction_id: string;
  account_mask: string;
  transaction_date: string;
  value_date: string | null;
  direction: "income" | "expense";
  amount: number;
  currency: string;
  counterparty_name: string | null;
  counterparty_account_mask: string | null;
  bank_reference: string | null;
  summary: string | null;
  balance: number | null;
  review_status: string;
  duplicate_transaction_id: string | null;
  payload_checksum: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  imported_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

type RawExternalBankSyncResult = {
  batch_id: string;
  staged_count: number;
  duplicate_count: number;
  next_cursor: string | null;
};

type RawTaxDeadlineRule = {
  id: string;
  company_id: string;
  tax_type: string;
  filing_frequency: string;
  due_month_offset: number;
  due_day: number;
  adjustment_policy: string;
  effective_from: string;
  effective_to: string | null;
  source_name: string;
  source_url: string | null;
  is_active: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type RawTaxCalendarDay = {
  id: string;
  company_id: string;
  calendar_date: string;
  day_type: string;
  reason: string;
  source_name: string;
  source_url: string | null;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type RawTaxDeclarationSchedule = {
  task_id: string;
  tax_type: string;
  form_name: string;
  period: string;
  due_date: string | null;
  rule_id: string | null;
  filing_frequency: string | null;
  calculation_basis: string | null;
  source_name: string | null;
  source_url: string | null;
  configuration_status: string;
};

type RawAdapterAuthorization = {
  id: string;
  company_id: string;
  company_name: string | null;
  adapter_type: string;
  adapter_code: string;
  region: string | null;
  auth_status: string;
  account_mask: string | null;
  login_identity: string | null;
  capability_scope: string | null;
  last_checked_at: string | null;
  expires_at: string | null;
  risk_message: string | null;
  created_at: string;
  updated_at: string;
};

type RawAdapterProviderConfig = {
  id: string;
  company_id: string;
  authorization_id: string;
  provider_name: string;
  endpoint: string;
  credential_env: string;
  timeout_seconds: number;
  is_enabled: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};

type RawOperationAuditLog = {
  id: string;
  company_id: string | null;
  company_name: string | null;
  module_name: string;
  action: string;
  object_ref: string | null;
  risk_level: string;
  result: string;
  detail: string | null;
  operator: string | null;
  created_at: string;
};

type RawEmployee = {
  id: string;
  company_id: string;
  employee_code: string;
  name: string;
  id_no: string | null;
  department: string | null;
  position: string | null;
  mobile: string | null;
  entry_date: string | null;
  employment_status: string;
  created_at: string;
  updated_at: string;
};

type RawPayrollRecord = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_name: string;
  period: string;
  base_salary: number;
  bonus: number;
  tax_amount: number;
  social_personal: number;
  net_salary: number;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawSocialSecurityRecord = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_name: string;
  period: string;
  city: string | null;
  contribution_base: number;
  company_amount: number;
  personal_amount: number;
  fund_amount: number;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawSpecialDeductionRecord = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_name: string;
  deduction_type: string;
  start_month: string;
  end_month: string | null;
  monthly_amount: number;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawBankTransaction = {
  id: string;
  company_id: string;
  period: string;
  account_name: string;
  serial_no: string;
  transaction_date: string;
  counterparty: string | null;
  summary: string | null;
  income_amount: number;
  expense_amount: number;
  balance: number | null;
  receipt_status: string;
  match_result: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawDocumentRecord = {
  id: string;
  company_id: string;
  period: string;
  business_date: string;
  document_code: string;
  business_type: string;
  partner: string | null;
  amount: number;
  owner: string | null;
  attachment_status: string;
  stamp_tax_item: string | null;
  stamp_tax_rate: number | null;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawBusinessOrder = {
  id: string;
  company_id: string;
  period: string;
  order_type: "purchase" | "sales";
  order_no: string;
  business_date: string;
  counterparty: string;
  goods_name: string;
  amount: number;
  fulfillment_status: string;
  invoice_status: string;
  settlement_status: string;
  status: string;
  source_document: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  created_at: string;
  updated_at: string;
};
type RawSettlementRecord = {
  id: string;
  company_id: string;
  period: string;
  settlement_type: "receivable" | "payable";
  settlement_no: string;
  settlement_date: string;
  counterparty: string;
  invoice_no: string | null;
  transaction_no: string | null;
  total_amount: number;
  settled_amount: number;
  balance_amount: number;
  settlement_method: string;
  owner: string | null;
  status: string;
  source_document: string | null;
  created_at: string;
  updated_at: string;
};
type RawBankReconciliationRecord = {
  id: string;
  company_id: string;
  period: string;
  reconciliation_no: string;
  reconciliation_date: string;
  bank_transaction_id: string | null;
  account_name: string;
  transaction_no: string;
  summary: string | null;
  bank_amount: number;
  book_amount: number;
  difference_amount: number;
  voucher_no: string | null;
  match_status: string;
  owner: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};
type RawCostCarryoverRecord = {
  id: string;
  company_id: string;
  period: string;
  batch_no: string;
  carryover_date: string;
  valuation_method: string;
  source_bill_no: string;
  inventory_name: string;
  debit_subject: string;
  credit_subject: string;
  cost_amount: number;
  difference_amount: number;
  voucher_id: string | null;
  voucher_no: string | null;
  status: string;
  source_document: string | null;
  created_at: string;
  updated_at: string;
};
type RawAccountTransfer = {
  id: string;
  company_id: string;
  period: string;
  transfer_date: string;
  from_account: string;
  to_account: string;
  amount: number;
  fee: number;
  serial_no: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawFixedAsset = {
  id: string;
  company_id: string;
  period: string;
  asset_code: string;
  asset_name: string;
  category: string;
  category_id: string | null;
  start_date: string;
  original_value: number;
  useful_life_months: number;
  residual_rate: number;
  depreciation_method: string;
  asset_account: string;
  accumulated_depreciation_account: string;
  expense_account: string | null;
  opening_accumulated_depreciation: number;
  opening_depreciation_months: number;
  source_document: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawDepreciationBatch = {
  id: string;
  company_id: string;
  period: string;
  asset_count: number;
  depreciation_amount: number;
  voucher_id: string | null;
  voucher_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawFixedAssetDepreciationLine = {
  id: string;
  batch_id: string;
  company_id: string;
  period: string;
  asset_id: string;
  asset_code: string;
  asset_name: string;
  category: string;
  depreciation_method: string;
  expense_account: string;
  accumulated_depreciation_account: string;
  depreciable_amount: number;
  months_depreciated: number;
  opening_accumulated_depreciation: number;
  depreciation_amount: number;
  closing_accumulated_depreciation: number;
  closing_net_value: number;
  voucher_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryMovement = {
  id: string;
  company_id: string;
  period: string;
  movement_date: string;
  bill_no: string;
  movement_type: string;
  inventory_name: string;
  warehouse: string;
  counterparty: string | null;
  unit: string;
  quantity: number;
  amount: number;
  inventory_item_id: string | null;
  warehouse_id: string | null;
  direction: "inbound" | "outbound" | null;
  unit_cost: number;
  confirmed_at: string | null;
  source_document: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryItem = {
  id: string;
  company_id: string;
  item_code: string;
  item_name: string;
  specification: string | null;
  unit: string;
  unit_id: string | null;
  tax_rate: number | null;
  default_subject: string | null;
  category: string | null;
  category_id: string | null;
  valuation_method: string;
  inventory_subject: string;
  cost_subject: string;
  safety_stock: number;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryCategory = {
  id: string;
  company_id: string;
  category_code: string;
  category_name: string;
  inventory_subject: string;
  cost_subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryWarehouse = {
  id: string;
  company_id: string;
  warehouse_code: string;
  warehouse_name: string;
  location: string | null;
  manager: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryBomLine = {
  id: string;
  bom_id: string;
  company_id: string;
  component_item_id: string;
  component_item_code: string;
  component_item_name: string;
  component_specification: string | null;
  component_unit: string;
  quantity: number;
  loss_rate: number;
  sort_order: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};
type RawInventoryBom = {
  id: string;
  company_id: string;
  bom_code: string;
  bom_name: string;
  version: string;
  parent_item_id: string;
  parent_item_code: string;
  parent_item_name: string;
  parent_specification: string | null;
  parent_unit: string;
  effective_date: string;
  expiration_date: string | null;
  status: string;
  note: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  lines: RawInventoryBomLine[];
};
type RawInventoryStockBalance = {
  inventory_item_id: string;
  item_code: string;
  item_name: string;
  warehouse: string;
  unit: string;
  quantity: number;
  amount: number;
  average_unit_cost: number;
  safety_stock: number;
};
type RawInventoryOpeningBalance = {
  id: string;
  company_id: string;
  period_id: string;
  period: string;
  inventory_item_id: string;
  warehouse_id: string;
  item_code: string;
  item_name: string;
  warehouse_name: string;
  unit: string;
  inventory_subject: string;
  quantity: number;
  amount: number;
  status: string;
  movement_id: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryOpeningReconciliation = {
  detail_amount: number;
  ledger_amount: number;
  difference_amount: number;
  is_reconciled: boolean;
  financial_opening_finalized: boolean;
  inventory_opening_finalized: boolean;
  message: string;
};
type RawInventoryStocktake = {
  id: string;
  company_id: string;
  period_id: string;
  period: string;
  stocktake_no: string;
  stocktake_date: string;
  warehouse_id: string;
  warehouse_name: string;
  status: string;
  note: string | null;
  source_movement_max_rowid: number;
  voucher_id: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
};
type RawInventoryStocktakeLine = {
  id: string;
  stocktake_id: string;
  company_id: string;
  inventory_item_id: string;
  item_code: string;
  item_name: string;
  unit: string;
  inventory_subject: string;
  book_quantity: number;
  book_amount: number;
  book_unit_cost: number;
  actual_quantity: number | null;
  actual_unit_cost: number | null;
  variance_quantity: number;
  variance_amount: number;
  reason: string | null;
  movement_id: string | null;
  created_at: string;
  updated_at: string;
};
type RawMeasurementUnit = {
  id: string;
  company_id: string;
  unit_name: string;
  unit_group: string | null;
  base_unit: string | null;
  conversion_rate: number;
  precision_digits: number;
  remark: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const mapAgencyServiceContract = (
  item: RawAgencyServiceContract,
): AgencyServiceContract => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  contractNo: item.contract_no,
  servicePackage: item.service_package,
  serviceStart: item.service_start,
  serviceEnd: item.service_end,
  monthlyFee: item.monthly_fee,
  renewalStatus: item.renewal_status,
  owner: item.owner,
  archiveStatus: item.archive_status,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAgencyFeeCollection = (
  item: RawAgencyFeeCollection,
): AgencyFeeCollection => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  period: item.period,
  receivableAmount: item.receivable_amount,
  receivedAmount: item.received_amount,
  arrearsAmount: item.arrears_amount,
  invoiceStatus: item.invoice_status,
  paymentStatus: item.payment_status,
  collector: item.collector,
  lastFollowUp: item.last_follow_up,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAgencyCollaborationItem = (
  item: RawAgencyCollaborationItem,
): AgencyCollaborationItem => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  todoTitle: item.todo_title,
  materialType: item.material_type,
  customerContact: item.customer_contact,
  reminderCount: item.reminder_count,
  lastContactAt: item.last_contact_at,
  replyStatus: item.reply_status,
  owner: item.owner,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAgencyDeliveryTicket = (
  item: RawAgencyDeliveryTicket,
): AgencyDeliveryTicket => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  ticketNo: item.ticket_no,
  taskName: item.task_name,
  period: item.period,
  currentStage: item.current_stage,
  slaStatus: item.sla_status,
  owner: item.owner,
  deliveryStatus: item.delivery_status,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAgencyBatchTask = (item: RawAgencyBatchTask): AgencyBatchTask => ({
  id: item.id,
  taskType: item.task_type,
  taskName: item.task_name,
  period: item.period,
  customerScope: item.customer_scope,
  status: item.status,
  progressCurrent: item.progress_current,
  progressTotal: item.progress_total,
  resultSummary: item.result_summary,
  riskLevel: item.risk_level,
  operator: item.operator,
  requiresApproval: item.requires_approval === 1,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAgencyBatchTaskItem = (
  item: RawAgencyBatchTaskItem,
): AgencyBatchTaskItem => ({
  id: item.id,
  taskId: item.task_id,
  companyId: item.company_id,
  companyName: item.company_name,
  periodId: item.period_id,
  action: item.action,
  status: item.status,
  resultSummary: item.result_summary,
  errorMessage: item.error_message,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAgencyHealthCheckItem = (
  item: RawAgencyHealthCheckItem,
): AgencyHealthCheckItem => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  moduleName: item.module_name,
  riskMessage: item.risk_message,
  riskLevel: item.risk_level,
  owner: item.owner,
  resolutionStatus: item.resolution_status,
});

const mapAgencyOperationOverview = (
  item: RawAgencyOperationOverview,
): AgencyOperationOverview => ({
  serviceContracts: item.service_contracts,
  expiringContracts: item.expiring_contracts,
  receivableAmount: item.receivable_amount,
  arrearsAmount: item.arrears_amount,
  pendingCollaboration: item.pending_collaboration,
  overdueCollaboration: item.overdue_collaboration,
  openTickets: item.open_tickets,
  blockedTickets: item.blocked_tickets,
});

const mapAgencyCompanyProgress = (
  item: RawAgencyCompanyProgress,
): AgencyCompanyProgress => ({
  companyId: item.company_id,
  period: item.period,
  invoiceCount: item.invoice_count,
  invoicePendingCount: item.invoice_pending_count,
  voucherCount: item.voucher_count,
  approvedVoucherCount: item.approved_voucher_count,
  taxTaskCount: item.tax_task_count,
  collectedTaxTaskCount: item.collected_tax_task_count,
  declaredTaxTaskCount: item.declared_tax_task_count,
  paidTaxTaskCount: item.paid_tax_task_count,
  riskCount: item.risk_count,
  latestActivityAt: item.latest_activity_at,
});

const mapAutomationJob = (item: RawAutomationJob): AutomationJob => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  period: item.period,
  jobType: item.job_type,
  sourceModule: item.source_module,
  sourceId: item.source_id,
  sourceFile: item.source_file,
  suggestionNo: item.suggestion_no,
  debitSubject: item.debit_subject,
  creditSubject: item.credit_subject,
  suggestionAmount: item.suggestion_amount,
  generatedVoucherId: item.generated_voucher_id,
  generatedVoucherNumber: item.generated_voucher_number,
  status: item.status,
  confidence: item.confidence,
  resultSummary: item.result_summary,
  riskLevel: item.risk_level,
  reviewer: item.reviewer,
  createdBy: item.created_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAiProviderConfig = (
  item: RawAiProviderConfig,
): AiProviderConfig => ({
  id: item.id,
  companyId: item.company_id,
  providerName: item.provider_name,
  providerType: item.provider_type,
  endpoint: item.endpoint,
  model: item.model,
  credentialEnv: item.credential_env,
  timeoutSeconds: item.timeout_seconds,
  maxFileBytes: item.max_file_bytes,
  isEnabled: item.is_enabled === 1,
  createdBy: item.created_by,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapTaxDeclarationTask = (
  item: RawTaxDeclarationTask,
): TaxDeclarationTask => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  period: item.period,
  taxType: item.tax_type,
  formName: item.form_name,
  collectStatus: item.collect_status,
  validationStatus: item.validation_status,
  declarationStatus: item.declaration_status,
  sourceSnapshot: item.source_snapshot,
  taxableAmount: item.taxable_amount,
  deductionAmount: item.deduction_amount,
  payableAmount: item.payable_amount,
  riskCount: item.risk_count,
  adapterCode: item.adapter_code,
  confirmedBy: item.confirmed_by,
  confirmedAt: item.confirmed_at,
  receiptNo: item.receipt_no,
  paymentStatus: item.payment_status,
  paymentNo: item.payment_no,
  receiptReceivedAt: item.receipt_received_at,
  snapshotVersion: item.snapshot_version,
  snapshotFingerprint: item.snapshot_fingerprint,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapExternalInvoiceSyncItem = (
  item: RawExternalInvoiceSyncItem,
): ExternalInvoiceSyncItem => ({
  id: item.id,
  batchId: item.batch_id,
  companyId: item.company_id,
  externalInvoiceId: item.external_invoice_id,
  invoiceType: item.invoice_type,
  invoiceCode: item.invoice_code,
  invoiceNo: item.invoice_no,
  invoiceDate: item.invoice_date,
  sellerName: item.seller_name,
  sellerTaxId: item.seller_tax_id,
  buyerName: item.buyer_name,
  buyerTaxId: item.buyer_tax_id,
  amount: item.amount,
  taxAmount: item.tax_amount,
  totalAmount: item.total_amount,
  taxRate: item.tax_rate,
  currency: item.currency,
  reviewStatus: item.review_status,
  duplicateInvoiceId: item.duplicate_invoice_id,
  payloadChecksum: item.payload_checksum,
  reviewedBy: item.reviewed_by,
  reviewedAt: item.reviewed_at,
  reviewNote: item.review_note,
  importedInvoiceId: item.imported_invoice_id,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapExternalBankSyncItem = (
  item: RawExternalBankSyncItem,
): ExternalBankSyncItem => ({
  id: item.id,
  batchId: item.batch_id,
  companyId: item.company_id,
  externalTransactionId: item.external_transaction_id,
  accountMask: item.account_mask,
  transactionDate: item.transaction_date,
  valueDate: item.value_date,
  direction: item.direction,
  amount: item.amount,
  currency: item.currency,
  counterpartyName: item.counterparty_name,
  counterpartyAccountMask: item.counterparty_account_mask,
  bankReference: item.bank_reference,
  summary: item.summary,
  balance: item.balance,
  reviewStatus: item.review_status,
  duplicateTransactionId: item.duplicate_transaction_id,
  payloadChecksum: item.payload_checksum,
  reviewedBy: item.reviewed_by,
  reviewedAt: item.reviewed_at,
  reviewNote: item.review_note,
  importedTransactionId: item.imported_transaction_id,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapTaxDeadlineRule = (item: RawTaxDeadlineRule): TaxDeadlineRule => ({
  id: item.id,
  companyId: item.company_id,
  taxType: item.tax_type,
  filingFrequency: item.filing_frequency,
  dueMonthOffset: item.due_month_offset,
  dueDay: item.due_day,
  adjustmentPolicy: item.adjustment_policy,
  effectiveFrom: item.effective_from,
  effectiveTo: item.effective_to,
  sourceName: item.source_name,
  sourceUrl: item.source_url,
  isActive: item.is_active === 1,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapTaxCalendarDay = (item: RawTaxCalendarDay): TaxCalendarDay => ({
  id: item.id,
  companyId: item.company_id,
  calendarDate: item.calendar_date,
  dayType: item.day_type,
  reason: item.reason,
  sourceName: item.source_name,
  sourceUrl: item.source_url,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapTaxDeclarationSchedule = (
  item: RawTaxDeclarationSchedule,
): TaxDeclarationSchedule => ({
  taskId: item.task_id,
  taxType: item.tax_type,
  formName: item.form_name,
  period: item.period,
  dueDate: item.due_date,
  ruleId: item.rule_id,
  filingFrequency: item.filing_frequency,
  calculationBasis: item.calculation_basis,
  sourceName: item.source_name,
  sourceUrl: item.source_url,
  configurationStatus: item.configuration_status,
});

const mapAdapterAuthorization = (
  item: RawAdapterAuthorization,
): AdapterAuthorization => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  adapterType: item.adapter_type,
  adapterCode: item.adapter_code,
  region: item.region,
  authStatus: item.auth_status,
  accountMask: item.account_mask,
  loginIdentity: item.login_identity,
  capabilityScope: item.capability_scope,
  lastCheckedAt: item.last_checked_at,
  expiresAt: item.expires_at,
  riskMessage: item.risk_message,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapAdapterProviderConfig = (
  item: RawAdapterProviderConfig,
): AdapterProviderConfig => ({
  id: item.id,
  companyId: item.company_id,
  authorizationId: item.authorization_id,
  providerName: item.provider_name,
  endpoint: item.endpoint,
  credentialEnv: item.credential_env,
  timeoutSeconds: item.timeout_seconds,
  isEnabled: item.is_enabled === 1,
  createdBy: item.created_by,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapOperationAuditLog = (
  item: RawOperationAuditLog,
): OperationAuditLog => ({
  id: item.id,
  companyId: item.company_id,
  companyName: item.company_name,
  moduleName: item.module_name,
  action: item.action,
  objectRef: item.object_ref,
  riskLevel: item.risk_level,
  result: item.result,
  detail: item.detail,
  operator: item.operator,
  createdAt: item.created_at,
});

const mapEmployee = (item: RawEmployee): Employee => ({
  id: item.id,
  companyId: item.company_id,
  employeeCode: item.employee_code,
  name: item.name,
  idNo: item.id_no,
  department: item.department,
  position: item.position,
  mobile: item.mobile,
  entryDate: item.entry_date,
  employmentStatus: item.employment_status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

const mapPayrollRecord = (item: RawPayrollRecord): PayrollRecord => ({
  id: item.id,
  companyId: item.company_id,
  employeeId: item.employee_id,
  employeeName: item.employee_name,
  period: item.period,
  baseSalary: item.base_salary,
  bonus: item.bonus,
  taxAmount: item.tax_amount,
  socialPersonal: item.social_personal,
  netSalary: item.net_salary,
  voucherId: item.voucher_id,
  voucherNumber: item.voucher_number,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapSocialSecurityRecord = (
  item: RawSocialSecurityRecord,
): SocialSecurityRecord => ({
  id: item.id,
  companyId: item.company_id,
  employeeId: item.employee_id,
  employeeName: item.employee_name,
  period: item.period,
  city: item.city,
  contributionBase: item.contribution_base,
  companyAmount: item.company_amount,
  personalAmount: item.personal_amount,
  fundAmount: item.fund_amount,
  voucherId: item.voucher_id,
  voucherNumber: item.voucher_number,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapSpecialDeductionRecord = (
  item: RawSpecialDeductionRecord,
): SpecialDeductionRecord => ({
  id: item.id,
  companyId: item.company_id,
  employeeId: item.employee_id,
  employeeName: item.employee_name,
  deductionType: item.deduction_type,
  startMonth: item.start_month,
  endMonth: item.end_month,
  monthlyAmount: item.monthly_amount,
  source: item.source,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapBankTransaction = (item: RawBankTransaction): BankTransaction => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  accountName: item.account_name,
  serialNo: item.serial_no,
  transactionDate: item.transaction_date,
  counterparty: item.counterparty,
  summary: item.summary,
  incomeAmount: item.income_amount,
  expenseAmount: item.expense_amount,
  balance: item.balance,
  receiptStatus: item.receipt_status,
  matchResult: item.match_result,
  voucherId: item.voucher_id ?? null,
  voucherNumber: item.voucher_number ?? null,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapDocumentRecord = (item: RawDocumentRecord): DocumentRecord => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  businessDate: item.business_date,
  documentCode: item.document_code,
  businessType: item.business_type,
  partner: item.partner,
  amount: item.amount,
  owner: item.owner,
  attachmentStatus: item.attachment_status,
  stampTaxItem: item.stamp_tax_item,
  stampTaxRate: item.stamp_tax_rate,
  voucherId: item.voucher_id,
  voucherNumber: item.voucher_number,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapBusinessOrder = (item: RawBusinessOrder): BusinessOrder => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  orderType: item.order_type,
  orderNo: item.order_no,
  businessDate: item.business_date,
  counterparty: item.counterparty,
  goodsName: item.goods_name,
  amount: item.amount,
  fulfillmentStatus: item.fulfillment_status,
  invoiceStatus: item.invoice_status,
  settlementStatus: item.settlement_status,
  status: item.status,
  sourceDocument: item.source_document,
  voucherId: item.voucher_id,
  voucherNumber: item.voucher_number,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapSettlementRecord = (item: RawSettlementRecord): SettlementRecord => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  settlementType: item.settlement_type,
  settlementNo: item.settlement_no,
  settlementDate: item.settlement_date,
  counterparty: item.counterparty,
  invoiceNo: item.invoice_no,
  transactionNo: item.transaction_no,
  totalAmount: item.total_amount,
  settledAmount: item.settled_amount,
  balanceAmount: item.balance_amount,
  settlementMethod: item.settlement_method,
  owner: item.owner,
  status: item.status,
  sourceDocument: item.source_document,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapBankReconciliationRecord = (
  item: RawBankReconciliationRecord,
): BankReconciliationRecord => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  reconciliationNo: item.reconciliation_no,
  reconciliationDate: item.reconciliation_date,
  bankTransactionId: item.bank_transaction_id,
  accountName: item.account_name,
  transactionNo: item.transaction_no,
  summary: item.summary,
  bankAmount: item.bank_amount,
  bookAmount: item.book_amount,
  differenceAmount: item.difference_amount,
  voucherNo: item.voucher_no,
  matchStatus: item.match_status,
  owner: item.owner,
  status: item.status,
  note: item.note,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapCostCarryoverRecord = (
  i: RawCostCarryoverRecord,
): CostCarryoverRecord => ({
  id: i.id,
  companyId: i.company_id,
  period: i.period,
  batchNo: i.batch_no,
  carryoverDate: i.carryover_date,
  valuationMethod: i.valuation_method,
  sourceBillNo: i.source_bill_no,
  inventoryName: i.inventory_name,
  debitSubject: i.debit_subject,
  creditSubject: i.credit_subject,
  costAmount: i.cost_amount,
  differenceAmount: i.difference_amount,
  voucherId: i.voucher_id,
  voucherNo: i.voucher_no,
  status: i.status,
  sourceDocument: i.source_document,
  createdAt: i.created_at,
  updatedAt: i.updated_at,
});
const mapAccountTransfer = (item: RawAccountTransfer): AccountTransfer => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  transferDate: item.transfer_date,
  fromAccount: item.from_account,
  toAccount: item.to_account,
  amount: item.amount,
  fee: item.fee,
  serialNo: item.serial_no,
  voucherId: item.voucher_id,
  voucherNumber: item.voucher_number,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapFixedAsset = (item: RawFixedAsset): FixedAsset => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  assetCode: item.asset_code,
  assetName: item.asset_name,
  category: item.category,
  categoryId: item.category_id,
  startDate: item.start_date,
  originalValue: item.original_value,
  usefulLifeMonths: item.useful_life_months,
  residualRate: item.residual_rate,
  depreciationMethod: item.depreciation_method,
  assetAccount: item.asset_account,
  accumulatedDepreciationAccount: item.accumulated_depreciation_account,
  expenseAccount: item.expense_account,
  openingAccumulatedDepreciation: item.opening_accumulated_depreciation,
  openingDepreciationMonths: item.opening_depreciation_months,
  sourceDocument: item.source_document,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapDepreciationBatch = (
  item: RawDepreciationBatch,
): DepreciationBatch => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  assetCount: item.asset_count,
  depreciationAmount: item.depreciation_amount,
  voucherId: item.voucher_id,
  voucherNumber: item.voucher_number,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapFixedAssetDepreciationLine = (
  item: RawFixedAssetDepreciationLine,
): FixedAssetDepreciationLine => ({
  id: item.id,
  batchId: item.batch_id,
  companyId: item.company_id,
  period: item.period,
  assetId: item.asset_id,
  assetCode: item.asset_code,
  assetName: item.asset_name,
  category: item.category,
  depreciationMethod: item.depreciation_method,
  expenseAccount: item.expense_account,
  accumulatedDepreciationAccount: item.accumulated_depreciation_account,
  depreciableAmount: item.depreciable_amount,
  monthsDepreciated: item.months_depreciated,
  openingAccumulatedDepreciation: item.opening_accumulated_depreciation,
  depreciationAmount: item.depreciation_amount,
  closingAccumulatedDepreciation: item.closing_accumulated_depreciation,
  closingNetValue: item.closing_net_value,
  voucherId: item.voucher_id,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryMovement = (
  item: RawInventoryMovement,
): InventoryMovement => ({
  id: item.id,
  companyId: item.company_id,
  period: item.period,
  movementDate: item.movement_date,
  billNo: item.bill_no,
  movementType: item.movement_type,
  inventoryName: item.inventory_name,
  warehouse: item.warehouse,
  counterparty: item.counterparty,
  unit: item.unit,
  quantity: item.quantity,
  amount: item.amount,
  inventoryItemId: item.inventory_item_id,
  warehouseId: item.warehouse_id,
  direction: item.direction,
  unitCost: item.unit_cost,
  confirmedAt: item.confirmed_at,
  sourceDocument: item.source_document,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryItem = (item: RawInventoryItem): InventoryItem => ({
  id: item.id,
  companyId: item.company_id,
  itemCode: item.item_code,
  itemName: item.item_name,
  specification: item.specification,
  unit: item.unit,
  unitId: item.unit_id,
  taxRate: item.tax_rate,
  defaultSubject: item.default_subject,
  category: item.category,
  categoryId: item.category_id,
  valuationMethod: item.valuation_method,
  inventorySubject: item.inventory_subject,
  costSubject: item.cost_subject,
  safetyStock: item.safety_stock,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryCategory = (
  item: RawInventoryCategory,
): InventoryCategory => ({
  id: item.id,
  companyId: item.company_id,
  categoryCode: item.category_code,
  categoryName: item.category_name,
  inventorySubject: item.inventory_subject,
  costSubject: item.cost_subject,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryWarehouse = (
  item: RawInventoryWarehouse,
): InventoryWarehouse => ({
  id: item.id,
  companyId: item.company_id,
  warehouseCode: item.warehouse_code,
  warehouseName: item.warehouse_name,
  location: item.location,
  manager: item.manager,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryBomLine = (item: RawInventoryBomLine): InventoryBomLine => ({
  id: item.id,
  bomId: item.bom_id,
  companyId: item.company_id,
  componentItemId: item.component_item_id,
  componentItemCode: item.component_item_code,
  componentItemName: item.component_item_name,
  componentSpecification: item.component_specification,
  componentUnit: item.component_unit,
  quantity: item.quantity,
  lossRate: item.loss_rate,
  sortOrder: item.sort_order,
  note: item.note,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryBom = (item: RawInventoryBom): InventoryBom => ({
  id: item.id,
  companyId: item.company_id,
  bomCode: item.bom_code,
  bomName: item.bom_name,
  version: item.version,
  parentItemId: item.parent_item_id,
  parentItemCode: item.parent_item_code,
  parentItemName: item.parent_item_name,
  parentSpecification: item.parent_specification,
  parentUnit: item.parent_unit,
  effectiveDate: item.effective_date,
  expirationDate: item.expiration_date,
  status: item.status,
  note: item.note,
  createdBy: item.created_by,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  lines: item.lines.map(mapInventoryBomLine),
});
const mapInventoryStockBalance = (
  item: RawInventoryStockBalance,
): InventoryStockBalance => ({
  inventoryItemId: item.inventory_item_id,
  itemCode: item.item_code,
  itemName: item.item_name,
  warehouse: item.warehouse,
  unit: item.unit,
  quantity: item.quantity,
  amount: item.amount,
  averageUnitCost: item.average_unit_cost,
  safetyStock: item.safety_stock,
});
const mapInventoryOpeningBalance = (
  item: RawInventoryOpeningBalance,
): InventoryOpeningBalance => ({
  id: item.id,
  companyId: item.company_id,
  periodId: item.period_id,
  period: item.period,
  inventoryItemId: item.inventory_item_id,
  warehouseId: item.warehouse_id,
  itemCode: item.item_code,
  itemName: item.item_name,
  warehouseName: item.warehouse_name,
  unit: item.unit,
  inventorySubject: item.inventory_subject,
  quantity: item.quantity,
  amount: item.amount,
  status: item.status,
  movementId: item.movement_id,
  confirmedAt: item.confirmed_at,
  confirmedBy: item.confirmed_by,
  createdBy: item.created_by,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryOpeningReconciliation = (
  item: RawInventoryOpeningReconciliation,
): InventoryOpeningReconciliation => ({
  detailAmount: item.detail_amount,
  ledgerAmount: item.ledger_amount,
  differenceAmount: item.difference_amount,
  isReconciled: item.is_reconciled,
  financialOpeningFinalized: item.financial_opening_finalized,
  inventoryOpeningFinalized: item.inventory_opening_finalized,
  message: item.message,
});
const mapInventoryStocktake = (
  item: RawInventoryStocktake,
): InventoryStocktake => ({
  id: item.id,
  companyId: item.company_id,
  periodId: item.period_id,
  period: item.period,
  stocktakeNo: item.stocktake_no,
  stocktakeDate: item.stocktake_date,
  warehouseId: item.warehouse_id,
  warehouseName: item.warehouse_name,
  status: item.status,
  note: item.note,
  sourceMovementMaxRowid: item.source_movement_max_rowid,
  voucherId: item.voucher_id,
  confirmedAt: item.confirmed_at,
  confirmedBy: item.confirmed_by,
  voidedAt: item.voided_at,
  voidedBy: item.voided_by,
  createdBy: item.created_by,
  updatedBy: item.updated_by,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapInventoryStocktakeLine = (
  item: RawInventoryStocktakeLine,
): InventoryStocktakeLine => ({
  id: item.id,
  stocktakeId: item.stocktake_id,
  companyId: item.company_id,
  inventoryItemId: item.inventory_item_id,
  itemCode: item.item_code,
  itemName: item.item_name,
  unit: item.unit,
  inventorySubject: item.inventory_subject,
  bookQuantity: item.book_quantity,
  bookAmount: item.book_amount,
  bookUnitCost: item.book_unit_cost,
  actualQuantity: item.actual_quantity,
  actualUnitCost: item.actual_unit_cost,
  varianceQuantity: item.variance_quantity,
  varianceAmount: item.variance_amount,
  reason: item.reason,
  movementId: item.movement_id,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});
const mapMeasurementUnit = (item: RawMeasurementUnit): MeasurementUnit => ({
  id: item.id,
  companyId: item.company_id,
  unitName: item.unit_name,
  unitGroup: item.unit_group,
  baseUnit: item.base_unit,
  conversionRate: item.conversion_rate,
  precisionDigits: item.precision_digits,
  remark: item.remark,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

// ============================================
// Agency operation API (机构运营)
// ============================================
export const agencyApi = {
  getServiceContracts: async (
    filters: { companyId?: string; status?: string } = {},
  ): Promise<ApiResponse<AgencyServiceContract[]>> => {
    try {
      const result = (await invoke(
        "get_agency_service_contracts",
        filters,
      )) as RawAgencyServiceContract[];
      return { success: true, data: result.map(mapAgencyServiceContract) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createServiceContract: async (input: {
    companyId: string;
    contractNo: string;
    servicePackage: string;
    serviceStart: string;
    serviceEnd: string;
    monthlyFee: number;
    owner?: string;
  }): Promise<ApiResponse<AgencyServiceContract>> => {
    try {
      const result = (await invoke("create_agency_service_contract", {
        input: {
          company_id: input.companyId,
          contract_no: input.contractNo,
          service_package: input.servicePackage,
          service_start: input.serviceStart,
          service_end: input.serviceEnd,
          monthly_fee: input.monthlyFee,
          owner: input.owner,
        },
      })) as RawAgencyServiceContract;
      return { success: true, data: mapAgencyServiceContract(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateServiceContract: async (input: {
    id: string;
    companyId: string;
    contractNo: string;
    servicePackage: string;
    serviceStart: string;
    serviceEnd: string;
    monthlyFee: number;
    renewalStatus: string;
    archiveStatus: string;
    status: string;
    owner?: string;
  }): Promise<ApiResponse<AgencyServiceContract>> => {
    try {
      const result = (await invoke("update_agency_service_contract", {
        input: {
          id: input.id,
          company_id: input.companyId,
          contract_no: input.contractNo,
          service_package: input.servicePackage,
          service_start: input.serviceStart,
          service_end: input.serviceEnd,
          monthly_fee: input.monthlyFee,
          renewal_status: input.renewalStatus,
          archive_status: input.archiveStatus,
          status: input.status,
          owner: input.owner,
        },
      })) as RawAgencyServiceContract;
      return { success: true, data: mapAgencyServiceContract(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getFeeCollections: async (
    filters: { companyId?: string; period?: string; status?: string } = {},
  ): Promise<ApiResponse<AgencyFeeCollection[]>> => {
    try {
      const result = (await invoke(
        "get_agency_fee_collections",
        filters,
      )) as RawAgencyFeeCollection[];
      return { success: true, data: result.map(mapAgencyFeeCollection) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createFeeCollection: async (input: {
    companyId: string;
    period: string;
    receivableAmount: number;
    receivedAmount: number;
    invoiceStatus?: string;
    paymentStatus?: string;
    collector?: string;
  }): Promise<ApiResponse<AgencyFeeCollection>> => {
    try {
      const result = (await invoke("create_agency_fee_collection", {
        input: {
          company_id: input.companyId,
          period: input.period,
          receivable_amount: input.receivableAmount,
          received_amount: input.receivedAmount,
          invoice_status: input.invoiceStatus,
          payment_status: input.paymentStatus,
          collector: input.collector,
        },
      })) as RawAgencyFeeCollection;
      return { success: true, data: mapAgencyFeeCollection(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateFeeCollection: async (input: {
    id: string;
    companyId: string;
    period: string;
    receivableAmount: number;
    receivedAmount: number;
    invoiceStatus: string;
    paymentStatus: string;
    collector?: string;
    lastFollowUp?: string;
    status: string;
  }): Promise<ApiResponse<AgencyFeeCollection>> => {
    try {
      const result = (await invoke("update_agency_fee_collection", {
        input: {
          id: input.id,
          company_id: input.companyId,
          period: input.period,
          receivable_amount: input.receivableAmount,
          received_amount: input.receivedAmount,
          invoice_status: input.invoiceStatus,
          payment_status: input.paymentStatus,
          collector: input.collector,
          last_follow_up: input.lastFollowUp,
          status: input.status,
        },
      })) as RawAgencyFeeCollection;
      return { success: true, data: mapAgencyFeeCollection(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getCollaborationItems: async (
    filters: { companyId?: string; status?: string } = {},
  ): Promise<ApiResponse<AgencyCollaborationItem[]>> => {
    try {
      const result = (await invoke(
        "get_agency_collaboration_items",
        filters,
      )) as RawAgencyCollaborationItem[];
      return { success: true, data: result.map(mapAgencyCollaborationItem) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createCollaborationItem: async (input: {
    companyId: string;
    todoTitle: string;
    materialType?: string;
    customerContact?: string;
    replyStatus?: string;
    owner?: string;
  }): Promise<ApiResponse<AgencyCollaborationItem>> => {
    try {
      const result = (await invoke("create_agency_collaboration_item", {
        input: {
          company_id: input.companyId,
          todo_title: input.todoTitle,
          material_type: input.materialType,
          customer_contact: input.customerContact,
          reply_status: input.replyStatus,
          owner: input.owner,
        },
      })) as RawAgencyCollaborationItem;
      return { success: true, data: mapAgencyCollaborationItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateCollaborationItem: async (input: {
    id: string;
    companyId: string;
    todoTitle: string;
    materialType?: string;
    customerContact?: string;
    replyStatus: string;
    owner?: string;
    reminderCount: number;
    lastContactAt?: string;
    status: string;
  }): Promise<ApiResponse<AgencyCollaborationItem>> => {
    try {
      const result = (await invoke("update_agency_collaboration_item", {
        input: {
          id: input.id,
          company_id: input.companyId,
          todo_title: input.todoTitle,
          material_type: input.materialType,
          customer_contact: input.customerContact,
          reply_status: input.replyStatus,
          owner: input.owner,
          reminder_count: input.reminderCount,
          last_contact_at: input.lastContactAt,
          status: input.status,
        },
      })) as RawAgencyCollaborationItem;
      return { success: true, data: mapAgencyCollaborationItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getDeliveryTickets: async (
    filters: { companyId?: string; period?: string; status?: string } = {},
  ): Promise<ApiResponse<AgencyDeliveryTicket[]>> => {
    try {
      const result = (await invoke(
        "get_agency_delivery_tickets",
        filters,
      )) as RawAgencyDeliveryTicket[];
      return { success: true, data: result.map(mapAgencyDeliveryTicket) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getBatchTasks: async (
    filters: { period?: string; status?: string } = {},
  ): Promise<ApiResponse<AgencyBatchTask[]>> => {
    try {
      const result = (await invoke(
        "get_agency_batch_tasks",
        filters,
      )) as RawAgencyBatchTask[];
      return { success: true, data: result.map(mapAgencyBatchTask) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  createBatchTasks: async (input: {
    period: string;
    taskTypes?: string[];
  }): Promise<ApiResponse<{ created: number; skipped: number }>> => {
    try {
      const result = (await invoke("create_agency_batch_tasks", {
        input: {
          period: input.period,
          task_types: input.taskTypes,
        },
      })) as { created: number; skipped: number };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  runBatchTaskPrecheck: async (input: {
    id: string;
  }): Promise<ApiResponse<AgencyBatchTask>> => {
    try {
      const result = (await invoke("run_agency_batch_task_precheck", {
        input: {
          id: input.id,
        },
      })) as RawAgencyBatchTask;
      return { success: true, data: mapAgencyBatchTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  reviewBatchTask: async (input: {
    id: string;
    decision: "approved" | "rejected";
  }): Promise<ApiResponse<AgencyBatchTask>> => {
    try {
      const result = (await invoke("review_agency_batch_task", {
        input: {
          id: input.id,
          decision: input.decision,
        },
      })) as RawAgencyBatchTask;
      return { success: true, data: mapAgencyBatchTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  runBatchTask: async (input: {
    id: string;
  }): Promise<ApiResponse<AgencyBatchTask>> => {
    try {
      const result = (await invoke("run_agency_batch_task", {
        input: { id: input.id },
      })) as RawAgencyBatchTask;
      return { success: true, data: mapAgencyBatchTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getBatchTaskItems: async (
    taskId: string,
  ): Promise<ApiResponse<AgencyBatchTaskItem[]>> => {
    try {
      const result = (await invoke("get_agency_batch_task_items", {
        taskId,
      })) as RawAgencyBatchTaskItem[];
      return { success: true, data: result.map(mapAgencyBatchTaskItem) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getHealthChecks: async (
    period = "2026-05",
  ): Promise<ApiResponse<AgencyHealthCheckItem[]>> => {
    try {
      const result = (await invoke("get_agency_health_checks", {
        period,
      })) as RawAgencyHealthCheckItem[];
      return { success: true, data: result.map(mapAgencyHealthCheckItem) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAutomationJobs: async (
    filters: { period?: string; status?: string } = {},
  ): Promise<ApiResponse<AutomationJob[]>> => {
    try {
      const result = (await invoke(
        "get_agency_automation_jobs",
        filters,
      )) as RawAutomationJob[];
      return { success: true, data: result.map(mapAutomationJob) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAuthorizations: async (
    filters: { adapterType?: string } = {},
  ): Promise<ApiResponse<AdapterAuthorization[]>> => {
    try {
      const result = (await invoke("get_agency_adapter_authorizations", {
        adapterType: filters.adapterType,
      })) as RawAdapterAuthorization[];
      return { success: true, data: result.map(mapAdapterAuthorization) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getOverview: async (
    period = "2026-05",
  ): Promise<ApiResponse<AgencyOperationOverview>> => {
    try {
      const result = (await invoke("get_agency_operation_overview", {
        period,
      })) as RawAgencyOperationOverview;
      return { success: true, data: mapAgencyOperationOverview(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getCompanyProgress: async (
    period?: string,
  ): Promise<ApiResponse<AgencyCompanyProgress[]>> => {
    try {
      const result = (await invoke("get_agency_company_progress", {
        period,
      })) as RawAgencyCompanyProgress[];
      return { success: true, data: result.map(mapAgencyCompanyProgress) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

// ============================================
// Automation / AI / tax adapter API
// ============================================
export const automationApi = {
  getAutomationJobs: async (filters: {
    companyId: string;
    period?: string;
    status?: string;
  }): Promise<ApiResponse<AutomationJob[]>> => {
    try {
      const result = (await invoke("get_automation_jobs", {
        companyId: filters.companyId,
        period: filters.period,
        status: filters.status,
      })) as RawAutomationJob[];
      return { success: true, data: result.map(mapAutomationJob) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  createAutomationJob: async (input: {
    companyId: string;
    period?: string;
    jobType: string;
    sourceModule: string;
    sourceId?: string;
    sourceFile?: string;
    suggestionNo?: string;
    debitSubject?: string;
    creditSubject?: string;
    suggestionAmount?: number;
    status?: string;
    confidence?: number;
    resultSummary?: string;
    riskLevel?: string;
    reviewer?: string;
  }): Promise<ApiResponse<AutomationJob>> => {
    try {
      const result = (await invoke("create_automation_job", {
        input: {
          company_id: input.companyId,
          period: input.period,
          job_type: input.jobType,
          source_module: input.sourceModule,
          source_id: input.sourceId,
          source_file: input.sourceFile,
          suggestion_no: input.suggestionNo,
          debit_subject: input.debitSubject,
          credit_subject: input.creditSubject,
          suggestion_amount: input.suggestionAmount,
          status: input.status,
          confidence: input.confidence,
          result_summary: input.resultSummary,
          risk_level: input.riskLevel,
          reviewer: input.reviewer,
        },
      })) as RawAutomationJob;
      return { success: true, data: mapAutomationJob(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  updateAutomationJobStatus: async (input: {
    id: string;
    companyId: string;
    status: string;
    confidence?: number;
    resultSummary?: string;
    riskLevel?: string;
  }): Promise<ApiResponse<AutomationJob>> => {
    try {
      const result = (await invoke("update_automation_job_status", {
        input: {
          id: input.id,
          company_id: input.companyId,
          status: input.status,
          confidence: input.confidence,
          result_summary: input.resultSummary,
          risk_level: input.riskLevel,
        },
      })) as RawAutomationJob;
      return { success: true, data: mapAutomationJob(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAiProviderConfigs: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<AiProviderConfig[]>> => {
    try {
      const result = (await invoke("get_ai_provider_configs", {
        companyId: filters.companyId,
      })) as RawAiProviderConfig[];
      return { success: true, data: result.map(mapAiProviderConfig) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsertAiProviderConfig: async (input: {
    id?: string;
    companyId: string;
    providerName: string;
    providerType: string;
    endpoint: string;
    model: string;
    credentialEnv: string;
    timeoutSeconds: number;
    maxFileBytes: number;
    isEnabled: boolean;
  }): Promise<ApiResponse<AiProviderConfig>> => {
    try {
      const result = (await invoke("upsert_ai_provider_config", {
        input: {
          id: input.id,
          company_id: input.companyId,
          provider_name: input.providerName,
          provider_type: input.providerType,
          endpoint: input.endpoint,
          model: input.model,
          credential_env: input.credentialEnv,
          timeout_seconds: input.timeoutSeconds,
          max_file_bytes: input.maxFileBytes,
          is_enabled: input.isEnabled ? 1 : 0,
        },
      })) as RawAiProviderConfig;
      return { success: true, data: mapAiProviderConfig(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  runAiRecognitionJob: async (input: {
    id: string;
    companyId: string;
    providerConfigId: string;
    disclosureConfirmed: boolean;
  }): Promise<ApiResponse<AutomationJob>> => {
    try {
      const result = (await invoke("run_ai_recognition_job", {
        input: {
          id: input.id,
          company_id: input.companyId,
          provider_config_id: input.providerConfigId,
          disclosure_confirmed: input.disclosureConfirmed,
        },
      })) as RawAutomationJob;
      return { success: true, data: mapAutomationJob(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getTaxDeclarationTasks: async (filters: {
    companyId: string;
    period?: string;
    declarationStatus?: string;
  }): Promise<ApiResponse<TaxDeclarationTask[]>> => {
    try {
      const result = (await invoke("get_tax_declaration_tasks", {
        companyId: filters.companyId,
        period: filters.period,
        declarationStatus: filters.declarationStatus,
      })) as RawTaxDeclarationTask[];
      return { success: true, data: result.map(mapTaxDeclarationTask) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getTaxDeadlineRules: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<TaxDeadlineRule[]>> => {
    try {
      const result = (await invoke("get_tax_deadline_rules", {
        companyId: filters.companyId,
      })) as RawTaxDeadlineRule[];
      return { success: true, data: result.map(mapTaxDeadlineRule) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsertTaxDeadlineRule: async (input: {
    companyId: string;
    taxType: string;
    filingFrequency: string;
    dueMonthOffset: number;
    dueDay: number;
    adjustmentPolicy: string;
    effectiveFrom: string;
    effectiveTo?: string;
    sourceName: string;
    sourceUrl?: string;
    isActive?: boolean;
  }): Promise<ApiResponse<TaxDeadlineRule>> => {
    try {
      const result = (await invoke("upsert_tax_deadline_rule", {
        input: {
          company_id: input.companyId,
          tax_type: input.taxType,
          filing_frequency: input.filingFrequency,
          due_month_offset: input.dueMonthOffset,
          due_day: input.dueDay,
          adjustment_policy: input.adjustmentPolicy,
          effective_from: input.effectiveFrom,
          effective_to: input.effectiveTo,
          source_name: input.sourceName,
          source_url: input.sourceUrl,
          is_active: input.isActive === false ? 0 : 1,
        },
      })) as RawTaxDeadlineRule;
      return { success: true, data: mapTaxDeadlineRule(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getTaxCalendarDays: async (filters: {
    companyId: string;
    year: number;
  }): Promise<ApiResponse<TaxCalendarDay[]>> => {
    try {
      const result = (await invoke("get_tax_calendar_days", {
        companyId: filters.companyId,
        year: filters.year,
      })) as RawTaxCalendarDay[];
      return { success: true, data: result.map(mapTaxCalendarDay) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsertTaxCalendarDay: async (input: {
    companyId: string;
    calendarDate: string;
    dayType: string;
    reason: string;
    sourceName: string;
    sourceUrl?: string;
  }): Promise<ApiResponse<TaxCalendarDay>> => {
    try {
      const result = (await invoke("upsert_tax_calendar_day", {
        input: {
          company_id: input.companyId,
          calendar_date: input.calendarDate,
          day_type: input.dayType,
          reason: input.reason,
          source_name: input.sourceName,
          source_url: input.sourceUrl,
        },
      })) as RawTaxCalendarDay;
      return { success: true, data: mapTaxCalendarDay(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getTaxDeclarationSchedules: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<TaxDeclarationSchedule[]>> => {
    try {
      const result = (await invoke("get_tax_declaration_schedules", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawTaxDeclarationSchedule[];
      return { success: true, data: result.map(mapTaxDeclarationSchedule) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsertTaxDeclarationTask: async (input: {
    companyId: string;
    period: string;
    taxType: string;
    formName: string;
    collectStatus?: string;
    validationStatus?: string;
    declarationStatus?: string;
    sourceSnapshot?: string;
    taxableAmount?: number;
    deductionAmount?: number;
    payableAmount?: number;
    riskCount?: number;
    adapterCode?: string;
    receiptNo?: string;
    paymentStatus?: string;
    paymentNo?: string;
    receiptReceivedAt?: string;
  }): Promise<ApiResponse<TaxDeclarationTask>> => {
    try {
      const result = (await invoke("upsert_tax_declaration_task", {
        input: {
          company_id: input.companyId,
          period: input.period,
          tax_type: input.taxType,
          form_name: input.formName,
          collect_status: input.collectStatus,
          validation_status: input.validationStatus,
          declaration_status: input.declarationStatus,
          source_snapshot: input.sourceSnapshot,
          taxable_amount: input.taxableAmount,
          deduction_amount: input.deductionAmount,
          payable_amount: input.payableAmount,
          risk_count: input.riskCount,
          adapter_code: input.adapterCode,
          receipt_no: input.receiptNo,
          payment_status: input.paymentStatus,
          payment_no: input.paymentNo,
          receipt_received_at: input.receiptReceivedAt,
        },
      })) as RawTaxDeclarationTask;
      return { success: true, data: mapTaxDeclarationTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  confirmTaxDeclarationTask: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<TaxDeclarationTask>> => {
    try {
      const result = (await invoke("confirm_tax_declaration_task", {
        input: {
          id: input.id,
          company_id: input.companyId,
        },
      })) as RawTaxDeclarationTask;
      return { success: true, data: mapTaxDeclarationTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  submitTaxDeclarationTask: async (input: {
    companyId: string;
    taskId: string;
    authorizationId: string;
    submissionConfirmed: boolean;
  }): Promise<ApiResponse<TaxDeclarationTask>> => {
    try {
      const result = (await invoke("submit_tax_declaration_task", {
        input: {
          company_id: input.companyId,
          task_id: input.taskId,
          authorization_id: input.authorizationId,
          submission_confirmed: input.submissionConfirmed,
        },
      })) as RawTaxDeclarationTask;
      return { success: true, data: mapTaxDeclarationTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  syncTaxDeclarationReceipt: async (input: {
    companyId: string;
    taskId: string;
    authorizationId: string;
    syncConfirmed: boolean;
  }): Promise<ApiResponse<TaxDeclarationTask>> => {
    try {
      const result = (await invoke("sync_tax_declaration_receipt", {
        input: {
          company_id: input.companyId,
          task_id: input.taskId,
          authorization_id: input.authorizationId,
          sync_confirmed: input.syncConfirmed,
        },
      })) as RawTaxDeclarationTask;
      return { success: true, data: mapTaxDeclarationTask(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  syncExternalInvoicePool: async (input: {
    companyId: string;
    authorizationId: string;
    period: string;
    sourceCursor?: string;
    syncConfirmed: boolean;
  }): Promise<ApiResponse<ExternalInvoiceSyncResult>> => {
    try {
      const result = (await invoke("sync_external_invoice_pool", {
        input: {
          company_id: input.companyId,
          authorization_id: input.authorizationId,
          period: input.period,
          source_cursor: input.sourceCursor,
          sync_confirmed: input.syncConfirmed,
        },
      })) as RawExternalInvoiceSyncResult;
      return {
        success: true,
        data: {
          batchId: result.batch_id,
          stagedCount: result.staged_count,
          duplicateCount: result.duplicate_count,
          nextCursor: result.next_cursor,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getExternalInvoiceSyncItems: async (filters: {
    companyId: string;
    batchId?: string;
    reviewStatus?: string;
  }): Promise<ApiResponse<ExternalInvoiceSyncItem[]>> => {
    try {
      const result = (await invoke("get_external_invoice_sync_items", {
        companyId: filters.companyId,
        batchId: filters.batchId,
        reviewStatus: filters.reviewStatus,
      })) as RawExternalInvoiceSyncItem[];
      return { success: true, data: result.map(mapExternalInvoiceSyncItem) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  importExternalInvoiceSyncItem: async (input: {
    companyId: string;
    itemId: string;
    reviewConfirmed: boolean;
    reviewNote?: string;
  }): Promise<ApiResponse<ExternalInvoiceSyncItem>> => {
    try {
      const result = (await invoke("import_external_invoice_sync_item", {
        input: {
          company_id: input.companyId,
          item_id: input.itemId,
          review_confirmed: input.reviewConfirmed,
          review_note: input.reviewNote,
        },
      })) as RawExternalInvoiceSyncItem;
      return { success: true, data: mapExternalInvoiceSyncItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  rejectExternalInvoiceSyncItem: async (input: {
    companyId: string;
    itemId: string;
    reviewConfirmed: boolean;
    reviewNote?: string;
  }): Promise<ApiResponse<ExternalInvoiceSyncItem>> => {
    try {
      const result = (await invoke("reject_external_invoice_sync_item", {
        input: {
          company_id: input.companyId,
          item_id: input.itemId,
          review_confirmed: input.reviewConfirmed,
          review_note: input.reviewNote,
        },
      })) as RawExternalInvoiceSyncItem;
      return { success: true, data: mapExternalInvoiceSyncItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  syncExternalBankStatement: async (input: {
    companyId: string;
    authorizationId: string;
    period: string;
    sourceCursor?: string;
    syncConfirmed: boolean;
  }): Promise<ApiResponse<ExternalBankSyncResult>> => {
    try {
      const result = (await invoke("sync_external_bank_statement", {
        input: {
          company_id: input.companyId,
          authorization_id: input.authorizationId,
          period: input.period,
          source_cursor: input.sourceCursor,
          sync_confirmed: input.syncConfirmed,
        },
      })) as RawExternalBankSyncResult;
      return {
        success: true,
        data: {
          batchId: result.batch_id,
          stagedCount: result.staged_count,
          duplicateCount: result.duplicate_count,
          nextCursor: result.next_cursor,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getExternalBankSyncItems: async (filters: {
    companyId: string;
    batchId?: string;
    reviewStatus?: string;
  }): Promise<ApiResponse<ExternalBankSyncItem[]>> => {
    try {
      const result = (await invoke("get_external_bank_sync_items", {
        companyId: filters.companyId,
        batchId: filters.batchId,
        reviewStatus: filters.reviewStatus,
      })) as RawExternalBankSyncItem[];
      return { success: true, data: result.map(mapExternalBankSyncItem) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  importExternalBankSyncItem: async (input: {
    companyId: string;
    itemId: string;
    reviewConfirmed: boolean;
    reviewNote?: string;
  }): Promise<ApiResponse<ExternalBankSyncItem>> => {
    try {
      const result = (await invoke("import_external_bank_sync_item", {
        input: {
          company_id: input.companyId,
          item_id: input.itemId,
          review_confirmed: input.reviewConfirmed,
          review_note: input.reviewNote,
        },
      })) as RawExternalBankSyncItem;
      return { success: true, data: mapExternalBankSyncItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  rejectExternalBankSyncItem: async (input: {
    companyId: string;
    itemId: string;
    reviewConfirmed: boolean;
    reviewNote?: string;
  }): Promise<ApiResponse<ExternalBankSyncItem>> => {
    try {
      const result = (await invoke("reject_external_bank_sync_item", {
        input: {
          company_id: input.companyId,
          item_id: input.itemId,
          review_confirmed: input.reviewConfirmed,
          review_note: input.reviewNote,
        },
      })) as RawExternalBankSyncItem;
      return { success: true, data: mapExternalBankSyncItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAdapterAuthorizations: async (filters: {
    companyId: string;
    adapterType?: string;
  }): Promise<ApiResponse<AdapterAuthorization[]>> => {
    try {
      const result = (await invoke("get_adapter_authorizations", {
        companyId: filters.companyId,
        adapterType: filters.adapterType,
      })) as RawAdapterAuthorization[];
      return { success: true, data: result.map(mapAdapterAuthorization) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsertAdapterAuthorization: async (input: {
    companyId: string;
    adapterType: string;
    adapterCode: string;
    region?: string;
    authStatus?: string;
    accountMask?: string;
    loginIdentity?: string;
    capabilityScope?: string;
    lastCheckedAt?: string;
    expiresAt?: string;
    riskMessage?: string;
  }): Promise<ApiResponse<AdapterAuthorization>> => {
    try {
      const result = (await invoke("upsert_adapter_authorization", {
        input: {
          company_id: input.companyId,
          adapter_type: input.adapterType,
          adapter_code: input.adapterCode,
          region: input.region,
          auth_status: input.authStatus,
          account_mask: input.accountMask,
          login_identity: input.loginIdentity,
          capability_scope: input.capabilityScope,
          last_checked_at: input.lastCheckedAt,
          expires_at: input.expiresAt,
          risk_message: input.riskMessage,
        },
      })) as RawAdapterAuthorization;
      return { success: true, data: mapAdapterAuthorization(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAdapterProviderConfig: async (input: {
    companyId: string;
    authorizationId: string;
  }): Promise<ApiResponse<AdapterProviderConfig | null>> => {
    try {
      const result = (await invoke("get_adapter_provider_config", {
        companyId: input.companyId,
        authorizationId: input.authorizationId,
      })) as RawAdapterProviderConfig | null;
      return {
        success: true,
        data: result ? mapAdapterProviderConfig(result) : null,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  upsertAdapterProviderConfig: async (input: {
    id?: string;
    companyId: string;
    authorizationId: string;
    providerName: string;
    endpoint: string;
    credentialEnv: string;
    timeoutSeconds: number;
    isEnabled: boolean;
  }): Promise<ApiResponse<AdapterProviderConfig>> => {
    try {
      const result = (await invoke("upsert_adapter_provider_config", {
        input: {
          id: input.id,
          company_id: input.companyId,
          authorization_id: input.authorizationId,
          provider_name: input.providerName,
          endpoint: input.endpoint,
          credential_env: input.credentialEnv,
          timeout_seconds: input.timeoutSeconds,
          is_enabled: input.isEnabled ? 1 : 0,
        },
      })) as RawAdapterProviderConfig;
      return { success: true, data: mapAdapterProviderConfig(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  verifyAdapterAuthorization: async (input: {
    companyId: string;
    authorizationId: string;
  }): Promise<ApiResponse<AdapterAuthorization>> => {
    try {
      const result = (await invoke("verify_adapter_authorization", {
        input: {
          company_id: input.companyId,
          authorization_id: input.authorizationId,
        },
      })) as RawAdapterAuthorization;
      return { success: true, data: mapAdapterAuthorization(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  writeOperationAuditLog: async (input: {
    companyId?: string;
    moduleName: string;
    action: string;
    objectRef?: string;
    riskLevel?: string;
    result?: string;
    detail?: string;
  }): Promise<ApiResponse<OperationAuditLog>> => {
    try {
      const result = (await invoke("write_operation_audit_log", {
        input: {
          company_id: input.companyId,
          module_name: input.moduleName,
          action: input.action,
          object_ref: input.objectRef,
          risk_level: input.riskLevel,
          result: input.result,
          detail: input.detail,
        },
      })) as RawOperationAuditLog;
      return { success: true, data: mapOperationAuditLog(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getOperationAuditLogs: async (
    filters: { companyId?: string; moduleName?: string } = {},
  ): Promise<ApiResponse<OperationAuditLog[]>> => {
    try {
      const result = (await invoke("get_operation_audit_logs", {
        companyId: filters.companyId,
        moduleName: filters.moduleName,
      })) as RawOperationAuditLog[];
      return { success: true, data: result.map(mapOperationAuditLog) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const backupApi = {
  createLocalBackup: async (): Promise<ApiResponse<LocalBackupSnapshot>> => {
    try {
      const result = (await invoke(
        "create_local_backup",
      )) as LocalBackupSnapshot;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  listLocalBackups: async (): Promise<ApiResponse<LocalBackupSnapshot[]>> => {
    try {
      const result = (await invoke(
        "list_local_backups",
      )) as LocalBackupSnapshot[];
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  verifyLocalBackup: async (
    backupId: string,
  ): Promise<ApiResponse<LocalBackupVerification>> => {
    try {
      const result = (await invoke("verify_local_backup", {
        backupId,
      })) as LocalBackupVerification;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  exportLocalBackup: async (
    backupId: string,
    targetPath: string,
  ): Promise<ApiResponse<LocalBackupExport>> => {
    try {
      const result = (await invoke("export_local_backup", {
        backupId,
        targetPath,
      })) as LocalBackupExport;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  scheduleLocalBackupRestore: async (
    backupId: string,
  ): Promise<ApiResponse<LocalBackupRestoreSchedule>> => {
    try {
      const result = (await invoke("schedule_local_backup_restore", {
        backupId,
      })) as LocalBackupRestoreSchedule;
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const employeeApi = {
  getEmployees: async (companyId: string): Promise<ApiResponse<Employee[]>> => {
    try {
      const result = (await invoke("get_employees", {
        companyId,
      })) as RawEmployee[];
      return { success: true, data: result.map(mapEmployee) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  createEmployee: async (input: {
    companyId: string;
    employeeCode: string;
    name: string;
    idNo?: string;
    department?: string;
    position?: string;
    mobile?: string;
    entryDate?: string;
    employmentStatus?: string;
  }): Promise<ApiResponse<Employee>> => {
    try {
      const result = (await invoke("create_employee", {
        input: {
          company_id: input.companyId,
          employee_code: input.employeeCode,
          name: input.name,
          id_no: input.idNo || undefined,
          department: input.department || undefined,
          position: input.position || undefined,
          mobile: input.mobile || undefined,
          entry_date: input.entryDate || undefined,
          employment_status: input.employmentStatus || undefined,
        },
      })) as RawEmployee;
      return { success: true, data: mapEmployee(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  updateEmployee: async (input: {
    id: string;
    companyId: string;
    employeeCode: string;
    name: string;
    idNo?: string;
    department?: string;
    position?: string;
    mobile?: string;
    entryDate?: string;
    employmentStatus?: string;
  }): Promise<ApiResponse<Employee>> => {
    try {
      const result = (await invoke("update_employee", {
        input: {
          id: input.id,
          company_id: input.companyId,
          employee_code: input.employeeCode,
          name: input.name,
          id_no: input.idNo || undefined,
          department: input.department || undefined,
          position: input.position || undefined,
          mobile: input.mobile || undefined,
          entry_date: input.entryDate || undefined,
          employment_status: input.employmentStatus || undefined,
        },
      })) as RawEmployee;
      return { success: true, data: mapEmployee(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const payrollApi = {
  getPayrollRecords: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<PayrollRecord[]>> => {
    try {
      const result = (await invoke("get_payroll_records", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawPayrollRecord[];
      return { success: true, data: result.map(mapPayrollRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  createPayrollRecord: async (input: {
    companyId: string;
    employeeId: string;
    period: string;
    baseSalary: number;
    bonus?: number;
    taxAmount?: number;
    socialPersonal?: number;
  }): Promise<ApiResponse<PayrollRecord>> => {
    try {
      const result = (await invoke("create_payroll_record", {
        input: {
          company_id: input.companyId,
          employee_id: input.employeeId,
          period: input.period,
          base_salary: input.baseSalary,
          bonus: input.bonus,
          tax_amount: input.taxAmount,
          social_personal: input.socialPersonal,
        },
      })) as RawPayrollRecord;
      return { success: true, data: mapPayrollRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  updatePayrollRecord: async (input: {
    id: string;
    companyId: string;
    employeeId: string;
    period: string;
    baseSalary: number;
    bonus?: number;
    taxAmount?: number;
    socialPersonal?: number;
  }): Promise<ApiResponse<PayrollRecord>> => {
    try {
      const result = (await invoke("update_payroll_record", {
        input: {
          id: input.id,
          company_id: input.companyId,
          employee_id: input.employeeId,
          period: input.period,
          base_salary: input.baseSalary,
          bonus: input.bonus,
          tax_amount: input.taxAmount,
          social_personal: input.socialPersonal,
        },
      })) as RawPayrollRecord;
      return { success: true, data: mapPayrollRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const socialSecurityApi = {
  getSocialSecurityRecords: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<SocialSecurityRecord[]>> => {
    try {
      const result = (await invoke("get_social_security_records", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawSocialSecurityRecord[];
      return { success: true, data: result.map(mapSocialSecurityRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createSocialSecurityRecord: async (input: {
    companyId: string;
    employeeId: string;
    period: string;
    city?: string;
    contributionBase: number;
    companyAmount: number;
    personalAmount: number;
    fundAmount: number;
  }): Promise<ApiResponse<SocialSecurityRecord>> => {
    try {
      const result = (await invoke("create_social_security_record", {
        input: {
          company_id: input.companyId,
          employee_id: input.employeeId,
          period: input.period,
          city: input.city,
          contribution_base: input.contributionBase,
          company_amount: input.companyAmount,
          personal_amount: input.personalAmount,
          fund_amount: input.fundAmount,
        },
      })) as RawSocialSecurityRecord;
      return { success: true, data: mapSocialSecurityRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateSocialSecurityRecord: async (input: {
    id: string;
    companyId: string;
    city?: string;
    contributionBase: number;
    companyAmount: number;
    personalAmount: number;
    fundAmount: number;
  }): Promise<ApiResponse<SocialSecurityRecord>> => {
    try {
      const result = (await invoke("update_social_security_record", {
        input: {
          id: input.id,
          company_id: input.companyId,
          city: input.city,
          contribution_base: input.contributionBase,
          company_amount: input.companyAmount,
          personal_amount: input.personalAmount,
          fund_amount: input.fundAmount,
        },
      })) as RawSocialSecurityRecord;
      return { success: true, data: mapSocialSecurityRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const specialDeductionApi = {
  getSpecialDeductionRecords: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<SpecialDeductionRecord[]>> => {
    try {
      const result = (await invoke("get_special_deduction_records", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawSpecialDeductionRecord[];
      return { success: true, data: result.map(mapSpecialDeductionRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createSpecialDeductionRecord: async (input: {
    companyId: string;
    employeeId: string;
    deductionType: string;
    startMonth: string;
    endMonth?: string;
    monthlyAmount: number;
    source?: string;
  }): Promise<ApiResponse<SpecialDeductionRecord>> => {
    try {
      const result = (await invoke("create_special_deduction_record", {
        input: {
          company_id: input.companyId,
          employee_id: input.employeeId,
          deduction_type: input.deductionType,
          start_month: input.startMonth,
          end_month: input.endMonth,
          monthly_amount: input.monthlyAmount,
          source: input.source,
        },
      })) as RawSpecialDeductionRecord;
      return { success: true, data: mapSpecialDeductionRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateSpecialDeductionRecord: async (input: {
    id: string;
    companyId: string;
    deductionType: string;
    startMonth: string;
    endMonth?: string;
    monthlyAmount: number;
    source?: string;
  }): Promise<ApiResponse<SpecialDeductionRecord>> => {
    try {
      const result = (await invoke("update_special_deduction_record", {
        input: {
          id: input.id,
          company_id: input.companyId,
          deduction_type: input.deductionType,
          start_month: input.startMonth,
          end_month: input.endMonth,
          monthly_amount: input.monthlyAmount,
          source: input.source,
        },
      })) as RawSpecialDeductionRecord;
      return { success: true, data: mapSpecialDeductionRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const bankTransactionApi = {
  getBankTransactions: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<BankTransaction[]>> => {
    try {
      const result = (await invoke("get_bank_transactions", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawBankTransaction[];
      return { success: true, data: result.map(mapBankTransaction) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createBankTransaction: async (input: {
    companyId: string;
    period: string;
    accountName: string;
    serialNo: string;
    transactionDate: string;
    counterparty?: string;
    summary?: string;
    incomeAmount: number;
    expenseAmount: number;
    balance?: number;
    receiptStatus?: string;
  }): Promise<ApiResponse<BankTransaction>> => {
    try {
      const result = (await invoke("create_bank_transaction", {
        input: {
          company_id: input.companyId,
          period: input.period,
          account_name: input.accountName,
          serial_no: input.serialNo,
          transaction_date: input.transactionDate,
          counterparty: input.counterparty,
          summary: input.summary,
          income_amount: input.incomeAmount,
          expense_amount: input.expenseAmount,
          balance: input.balance,
          receipt_status: input.receiptStatus,
        },
      })) as RawBankTransaction;
      return { success: true, data: mapBankTransaction(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateBankTransaction: async (input: {
    id: string;
    companyId: string;
    accountName: string;
    serialNo: string;
    transactionDate: string;
    counterparty?: string;
    summary?: string;
    incomeAmount: number;
    expenseAmount: number;
    balance?: number;
    receiptStatus?: string;
  }): Promise<ApiResponse<BankTransaction>> => {
    try {
      const result = (await invoke("update_bank_transaction", {
        input: {
          id: input.id,
          company_id: input.companyId,
          account_name: input.accountName,
          serial_no: input.serialNo,
          transaction_date: input.transactionDate,
          counterparty: input.counterparty,
          summary: input.summary,
          income_amount: input.incomeAmount,
          expense_amount: input.expenseAmount,
          balance: input.balance,
          receipt_status: input.receiptStatus,
        },
      })) as RawBankTransaction;
      return { success: true, data: mapBankTransaction(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const documentRecordApi = {
  getDocumentRecords: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<DocumentRecord[]>> => {
    try {
      const result = (await invoke("get_document_records", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawDocumentRecord[];
      return { success: true, data: result.map(mapDocumentRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createDocumentRecord: async (input: {
    companyId: string;
    period: string;
    businessDate: string;
    documentCode: string;
    businessType: string;
    partner?: string;
    amount: number;
    owner?: string;
    attachmentStatus?: string;
    stampTaxItem?: string;
    stampTaxRate?: number;
  }): Promise<ApiResponse<DocumentRecord>> => {
    try {
      const result = (await invoke("create_document_record", {
        input: {
          company_id: input.companyId,
          period: input.period,
          business_date: input.businessDate,
          document_code: input.documentCode,
          business_type: input.businessType,
          partner: input.partner,
          amount: input.amount,
          owner: input.owner,
          attachment_status: input.attachmentStatus,
          stamp_tax_item: input.stampTaxItem,
          stamp_tax_rate: input.stampTaxRate,
        },
      })) as RawDocumentRecord;
      return { success: true, data: mapDocumentRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateDocumentRecord: async (input: {
    id: string;
    companyId: string;
    businessDate: string;
    documentCode: string;
    businessType: string;
    partner?: string;
    amount: number;
    owner?: string;
    attachmentStatus?: string;
    stampTaxItem?: string;
    stampTaxRate?: number;
  }): Promise<ApiResponse<DocumentRecord>> => {
    try {
      const result = (await invoke("update_document_record", {
        input: {
          id: input.id,
          company_id: input.companyId,
          business_date: input.businessDate,
          document_code: input.documentCode,
          business_type: input.businessType,
          partner: input.partner,
          amount: input.amount,
          owner: input.owner,
          attachment_status: input.attachmentStatus,
          stamp_tax_item: input.stampTaxItem,
          stamp_tax_rate: input.stampTaxRate,
        },
      })) as RawDocumentRecord;
      return { success: true, data: mapDocumentRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const businessOrderApi = {
  getBusinessOrders: async (filters: {
    companyId: string;
    period: string;
    orderType: "purchase" | "sales";
  }): Promise<ApiResponse<BusinessOrder[]>> => {
    try {
      const result = (await invoke("get_business_orders", {
        companyId: filters.companyId,
        period: filters.period,
        orderType: filters.orderType,
      })) as RawBusinessOrder[];
      return { success: true, data: result.map(mapBusinessOrder) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createBusinessOrder: async (input: {
    companyId: string;
    period: string;
    orderType: "purchase" | "sales";
    orderNo: string;
    businessDate: string;
    counterparty: string;
    goodsName: string;
    amount: number;
    fulfillmentStatus?: string;
    invoiceStatus?: string;
    settlementStatus?: string;
    status?: string;
    sourceDocument?: string;
  }): Promise<ApiResponse<BusinessOrder>> => {
    try {
      const result = (await invoke("create_business_order", {
        input: {
          company_id: input.companyId,
          period: input.period,
          order_type: input.orderType,
          order_no: input.orderNo,
          business_date: input.businessDate,
          counterparty: input.counterparty,
          goods_name: input.goodsName,
          amount: input.amount,
          fulfillment_status: input.fulfillmentStatus,
          invoice_status: input.invoiceStatus,
          settlement_status: input.settlementStatus,
          status: input.status,
          source_document: input.sourceDocument,
        },
      })) as RawBusinessOrder;
      return { success: true, data: mapBusinessOrder(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateBusinessOrder: async (input: {
    id: string;
    companyId: string;
    orderNo: string;
    businessDate: string;
    counterparty: string;
    goodsName: string;
    amount: number;
    fulfillmentStatus?: string;
    invoiceStatus?: string;
    settlementStatus?: string;
    status?: string;
    sourceDocument?: string;
  }): Promise<ApiResponse<BusinessOrder>> => {
    try {
      const result = (await invoke("update_business_order", {
        input: {
          id: input.id,
          company_id: input.companyId,
          order_no: input.orderNo,
          business_date: input.businessDate,
          counterparty: input.counterparty,
          goods_name: input.goodsName,
          amount: input.amount,
          fulfillment_status: input.fulfillmentStatus,
          invoice_status: input.invoiceStatus,
          settlement_status: input.settlementStatus,
          status: input.status,
          source_document: input.sourceDocument,
        },
      })) as RawBusinessOrder;
      return { success: true, data: mapBusinessOrder(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const settlementRecordApi = {
  getSettlementRecords: async (filters: {
    companyId: string;
    period: string;
    settlementType: "receivable" | "payable";
  }): Promise<ApiResponse<SettlementRecord[]>> => {
    try {
      const result = (await invoke("get_settlement_records", {
        companyId: filters.companyId,
        period: filters.period,
        settlementType: filters.settlementType,
      })) as RawSettlementRecord[];
      return { success: true, data: result.map(mapSettlementRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createSettlementRecord: async (input: {
    companyId: string;
    period: string;
    settlementType: "receivable" | "payable";
    settlementNo: string;
    settlementDate: string;
    counterparty: string;
    invoiceNo?: string;
    transactionNo?: string;
    totalAmount: number;
    settledAmount: number;
    settlementMethod?: string;
    owner?: string;
    status?: string;
    sourceDocument?: string;
  }): Promise<ApiResponse<SettlementRecord>> => {
    try {
      const result = (await invoke("create_settlement_record", {
        input: {
          company_id: input.companyId,
          period: input.period,
          settlement_type: input.settlementType,
          settlement_no: input.settlementNo,
          settlement_date: input.settlementDate,
          counterparty: input.counterparty,
          invoice_no: input.invoiceNo,
          transaction_no: input.transactionNo,
          total_amount: input.totalAmount,
          settled_amount: input.settledAmount,
          settlement_method: input.settlementMethod,
          owner: input.owner,
          status: input.status,
          source_document: input.sourceDocument,
        },
      })) as RawSettlementRecord;
      return { success: true, data: mapSettlementRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateSettlementRecord: async (input: {
    id: string;
    companyId: string;
    settlementNo: string;
    settlementDate: string;
    counterparty: string;
    invoiceNo?: string;
    transactionNo?: string;
    totalAmount: number;
    settledAmount: number;
    settlementMethod?: string;
    owner?: string;
    status?: string;
    sourceDocument?: string;
  }): Promise<ApiResponse<SettlementRecord>> => {
    try {
      const result = (await invoke("update_settlement_record", {
        input: {
          id: input.id,
          company_id: input.companyId,
          settlement_no: input.settlementNo,
          settlement_date: input.settlementDate,
          counterparty: input.counterparty,
          invoice_no: input.invoiceNo,
          transaction_no: input.transactionNo,
          total_amount: input.totalAmount,
          settled_amount: input.settledAmount,
          settlement_method: input.settlementMethod,
          owner: input.owner,
          status: input.status,
          source_document: input.sourceDocument,
        },
      })) as RawSettlementRecord;
      return { success: true, data: mapSettlementRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const bankReconciliationApi = {
  getBankReconciliationRecords: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<BankReconciliationRecord[]>> => {
    try {
      const result = (await invoke("get_bank_reconciliation_records", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawBankReconciliationRecord[];
      return { success: true, data: result.map(mapBankReconciliationRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createBankReconciliationRecord: async (
    input: any,
  ): Promise<ApiResponse<BankReconciliationRecord>> => {
    try {
      const result = (await invoke("create_bank_reconciliation_record", {
        input: {
          ...input,
          company_id: input.companyId,
          bank_transaction_id: input.bankTransactionId,
          reconciliation_no: input.reconciliationNo,
          reconciliation_date: input.reconciliationDate,
          account_name: input.accountName,
          transaction_no: input.transactionNo,
          bank_amount: input.bankAmount,
          book_amount: input.bookAmount,
          voucher_no: input.voucherNo,
          match_status: input.matchStatus,
        },
      })) as RawBankReconciliationRecord;
      return { success: true, data: mapBankReconciliationRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateBankReconciliationRecord: async (
    input: any,
  ): Promise<ApiResponse<BankReconciliationRecord>> => {
    try {
      const result = (await invoke("update_bank_reconciliation_record", {
        input: {
          ...input,
          company_id: input.companyId,
          bank_transaction_id: input.bankTransactionId,
          reconciliation_no: input.reconciliationNo,
          reconciliation_date: input.reconciliationDate,
          account_name: input.accountName,
          transaction_no: input.transactionNo,
          bank_amount: input.bankAmount,
          book_amount: input.bookAmount,
          voucher_no: input.voucherNo,
          match_status: input.matchStatus,
        },
      })) as RawBankReconciliationRecord;
      return { success: true, data: mapBankReconciliationRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};
export const costCarryoverApi = {
  getCostCarryoverRecords: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<CostCarryoverRecord[]>> => {
    try {
      const r = (await invoke("get_cost_carryover_records", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawCostCarryoverRecord[];
      return { success: true, data: r.map(mapCostCarryoverRecord) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateCostCarryoverRecord: async (
    input: any,
  ): Promise<ApiResponse<CostCarryoverRecord>> => {
    try {
      const r = (await invoke("update_cost_carryover_record", {
        input: {
          ...input,
          company_id: input.companyId,
          batch_no: input.batchNo,
          carryover_date: input.carryoverDate,
          valuation_method: input.valuationMethod,
          source_bill_no: input.sourceBillNo,
          inventory_name: input.inventoryName,
          debit_subject: input.debitSubject,
          credit_subject: input.creditSubject,
          cost_amount: input.costAmount,
          difference_amount: input.differenceAmount,
          voucher_no: input.voucherNo,
          source_document: input.sourceDocument,
        },
      })) as RawCostCarryoverRecord;
      return { success: true, data: mapCostCarryoverRecord(r) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const accountTransferApi = {
  getAccountTransfers: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<AccountTransfer[]>> => {
    try {
      const result = (await invoke("get_account_transfers", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawAccountTransfer[];
      return { success: true, data: result.map(mapAccountTransfer) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createAccountTransfer: async (input: {
    companyId: string;
    period: string;
    transferDate: string;
    fromAccount: string;
    toAccount: string;
    amount: number;
    fee?: number;
    serialNo?: string;
  }): Promise<ApiResponse<AccountTransfer>> => {
    try {
      const result = (await invoke("create_account_transfer", {
        input: {
          company_id: input.companyId,
          period: input.period,
          transfer_date: input.transferDate,
          from_account: input.fromAccount,
          to_account: input.toAccount,
          amount: input.amount,
          fee: input.fee,
          serial_no: input.serialNo,
        },
      })) as RawAccountTransfer;
      return { success: true, data: mapAccountTransfer(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateAccountTransfer: async (input: {
    id: string;
    companyId: string;
    transferDate: string;
    fromAccount: string;
    toAccount: string;
    amount: number;
    fee?: number;
    serialNo?: string;
  }): Promise<ApiResponse<AccountTransfer>> => {
    try {
      const result = (await invoke("update_account_transfer", {
        input: {
          id: input.id,
          company_id: input.companyId,
          transfer_date: input.transferDate,
          from_account: input.fromAccount,
          to_account: input.toAccount,
          amount: input.amount,
          fee: input.fee,
          serial_no: input.serialNo,
        },
      })) as RawAccountTransfer;
      return { success: true, data: mapAccountTransfer(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const fixedAssetApi = {
  getFixedAssets: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<FixedAsset[]>> => {
    try {
      const result = (await invoke("get_fixed_assets", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawFixedAsset[];
      return { success: true, data: result.map(mapFixedAsset) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getDepreciationBatch: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<DepreciationBatch | null>> => {
    try {
      const result = (await invoke("get_fixed_asset_depreciation_batch", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawDepreciationBatch | null;
      return {
        success: true,
        data: result ? mapDepreciationBatch(result) : null,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getDepreciationLines: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<FixedAssetDepreciationLine[]>> => {
    try {
      const result = (await invoke("get_fixed_asset_depreciation_lines", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawFixedAssetDepreciationLine[];
      return {
        success: true,
        data: result.map(mapFixedAssetDepreciationLine),
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  prepareDepreciationBatch: async (input: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<DepreciationBatch>> => {
    try {
      const result = (await invoke("prepare_fixed_asset_depreciation_batch", {
        companyId: input.companyId,
        period: input.period,
      })) as RawDepreciationBatch;
      return { success: true, data: mapDepreciationBatch(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createFixedAsset: async (input: {
    companyId: string;
    period: string;
    assetCode: string;
    assetName: string;
    categoryId: string;
    startDate: string;
    originalValue: number;
    usefulLifeMonths: number;
    residualRate?: number;
    openingAccumulatedDepreciation?: number;
    openingDepreciationMonths?: number;
    sourceDocument?: string;
  }): Promise<ApiResponse<FixedAsset>> => {
    try {
      const result = (await invoke("create_fixed_asset", {
        input: {
          company_id: input.companyId,
          period: input.period,
          asset_code: input.assetCode,
          asset_name: input.assetName,
          category_id: input.categoryId,
          start_date: input.startDate,
          original_value: input.originalValue,
          useful_life_months: input.usefulLifeMonths,
          residual_rate: input.residualRate,
          opening_accumulated_depreciation:
            input.openingAccumulatedDepreciation,
          opening_depreciation_months: input.openingDepreciationMonths,
          source_document: input.sourceDocument,
        },
      })) as RawFixedAsset;
      return { success: true, data: mapFixedAsset(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateFixedAsset: async (input: {
    id: string;
    companyId: string;
    assetCode: string;
    assetName: string;
    categoryId: string;
    startDate: string;
    originalValue: number;
    usefulLifeMonths: number;
    residualRate?: number;
    openingAccumulatedDepreciation?: number;
    openingDepreciationMonths?: number;
    sourceDocument?: string;
  }): Promise<ApiResponse<FixedAsset>> => {
    try {
      const result = (await invoke("update_fixed_asset", {
        input: {
          id: input.id,
          company_id: input.companyId,
          asset_code: input.assetCode,
          asset_name: input.assetName,
          category_id: input.categoryId,
          start_date: input.startDate,
          original_value: input.originalValue,
          useful_life_months: input.usefulLifeMonths,
          residual_rate: input.residualRate,
          opening_accumulated_depreciation:
            input.openingAccumulatedDepreciation,
          opening_depreciation_months: input.openingDepreciationMonths,
          source_document: input.sourceDocument,
        },
      })) as RawFixedAsset;
      return { success: true, data: mapFixedAsset(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const inventoryMasterDataApi = {
  getInventoryCategories: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<InventoryCategory[]>> => {
    try {
      const result = (await invoke("get_inventory_categories", {
        companyId: filters.companyId,
      })) as RawInventoryCategory[];
      return { success: true, data: result.map(mapInventoryCategory) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createInventoryCategory: async (input: {
    companyId: string;
    categoryCode: string;
    categoryName: string;
    inventorySubject: string;
    costSubject: string;
    status?: string;
  }): Promise<ApiResponse<InventoryCategory>> => {
    try {
      const result = (await invoke("create_inventory_category", {
        input: {
          company_id: input.companyId,
          category_code: input.categoryCode,
          category_name: input.categoryName,
          inventory_subject: input.inventorySubject,
          cost_subject: input.costSubject,
          status: input.status,
        },
      })) as RawInventoryCategory;
      return { success: true, data: mapInventoryCategory(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateInventoryCategory: async (input: {
    id: string;
    companyId: string;
    categoryCode: string;
    categoryName: string;
    inventorySubject: string;
    costSubject: string;
    status: string;
  }): Promise<ApiResponse<InventoryCategory>> => {
    try {
      const result = (await invoke("update_inventory_category", {
        input: {
          id: input.id,
          company_id: input.companyId,
          category_code: input.categoryCode,
          category_name: input.categoryName,
          inventory_subject: input.inventorySubject,
          cost_subject: input.costSubject,
          status: input.status,
        },
      })) as RawInventoryCategory;
      return { success: true, data: mapInventoryCategory(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getInventoryWarehouses: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<InventoryWarehouse[]>> => {
    try {
      const result = (await invoke("get_inventory_warehouses", {
        companyId: filters.companyId,
      })) as RawInventoryWarehouse[];
      return { success: true, data: result.map(mapInventoryWarehouse) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createInventoryWarehouse: async (input: {
    companyId: string;
    warehouseCode: string;
    warehouseName: string;
    location?: string;
    manager?: string;
    status?: string;
  }): Promise<ApiResponse<InventoryWarehouse>> => {
    try {
      const result = (await invoke("create_inventory_warehouse", {
        input: {
          company_id: input.companyId,
          warehouse_code: input.warehouseCode,
          warehouse_name: input.warehouseName,
          location: input.location,
          manager: input.manager,
          status: input.status,
        },
      })) as RawInventoryWarehouse;
      return { success: true, data: mapInventoryWarehouse(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateInventoryWarehouse: async (input: {
    id: string;
    companyId: string;
    warehouseCode: string;
    warehouseName: string;
    location?: string;
    manager?: string;
    status: string;
  }): Promise<ApiResponse<InventoryWarehouse>> => {
    try {
      const result = (await invoke("update_inventory_warehouse", {
        input: {
          id: input.id,
          company_id: input.companyId,
          warehouse_code: input.warehouseCode,
          warehouse_name: input.warehouseName,
          location: input.location,
          manager: input.manager,
          status: input.status,
        },
      })) as RawInventoryWarehouse;
      return { success: true, data: mapInventoryWarehouse(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getInventoryBoms: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<InventoryBom[]>> => {
    try {
      const result = (await invoke("get_inventory_boms", {
        companyId: filters.companyId,
      })) as RawInventoryBom[];
      return { success: true, data: result.map(mapInventoryBom) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createInventoryBom: async (input: {
    companyId: string;
    bomCode: string;
    bomName: string;
    version: string;
    parentItemId: string;
    effectiveDate: string;
    expirationDate?: string;
    status?: string;
    note?: string;
    lines: Array<{
      componentItemId: string;
      quantity: number;
      lossRate: number;
      sortOrder: number;
      note?: string;
    }>;
  }): Promise<ApiResponse<InventoryBom>> => {
    try {
      const result = (await invoke("create_inventory_bom", {
        input: {
          company_id: input.companyId,
          bom_code: input.bomCode,
          bom_name: input.bomName,
          version: input.version,
          parent_item_id: input.parentItemId,
          effective_date: input.effectiveDate,
          expiration_date: input.expirationDate,
          status: input.status,
          note: input.note,
          lines: input.lines.map((line) => ({
            component_item_id: line.componentItemId,
            quantity: line.quantity,
            loss_rate: line.lossRate,
            sort_order: line.sortOrder,
            note: line.note,
          })),
        },
      })) as RawInventoryBom;
      return { success: true, data: mapInventoryBom(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateInventoryBom: async (input: {
    id: string;
    companyId: string;
    bomCode: string;
    bomName: string;
    version: string;
    parentItemId: string;
    effectiveDate: string;
    expirationDate?: string;
    status: string;
    note?: string;
    lines: Array<{
      componentItemId: string;
      quantity: number;
      lossRate: number;
      sortOrder: number;
      note?: string;
    }>;
  }): Promise<ApiResponse<InventoryBom>> => {
    try {
      const result = (await invoke("update_inventory_bom", {
        input: {
          id: input.id,
          company_id: input.companyId,
          bom_code: input.bomCode,
          bom_name: input.bomName,
          version: input.version,
          parent_item_id: input.parentItemId,
          effective_date: input.effectiveDate,
          expiration_date: input.expirationDate,
          status: input.status,
          note: input.note,
          lines: input.lines.map((line) => ({
            component_item_id: line.componentItemId,
            quantity: line.quantity,
            loss_rate: line.lossRate,
            sort_order: line.sortOrder,
            note: line.note,
          })),
        },
      })) as RawInventoryBom;
      return { success: true, data: mapInventoryBom(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const inventoryOpeningApi = {
  getInventoryOpeningBalances: async (filters: {
    companyId: string;
    periodId: string;
  }): Promise<ApiResponse<InventoryOpeningBalance[]>> => {
    try {
      const result = (await invoke("get_inventory_opening_balances", {
        companyId: filters.companyId,
        periodId: filters.periodId,
      })) as RawInventoryOpeningBalance[];
      return { success: true, data: result.map(mapInventoryOpeningBalance) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getInventoryOpeningReconciliation: async (filters: {
    companyId: string;
    periodId: string;
  }): Promise<ApiResponse<InventoryOpeningReconciliation>> => {
    try {
      const result = (await invoke("get_inventory_opening_reconciliation", {
        companyId: filters.companyId,
        periodId: filters.periodId,
      })) as RawInventoryOpeningReconciliation;
      return { success: true, data: mapInventoryOpeningReconciliation(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  saveInventoryOpeningBalance: async (input: {
    companyId: string;
    periodId: string;
    inventoryItemId: string;
    warehouseId: string;
    quantity: number;
    amount: number;
  }): Promise<ApiResponse<InventoryOpeningBalance>> => {
    try {
      const result = (await invoke("save_inventory_opening_balance", {
        input: {
          company_id: input.companyId,
          period_id: input.periodId,
          inventory_item_id: input.inventoryItemId,
          warehouse_id: input.warehouseId,
          quantity: input.quantity,
          amount: input.amount,
        },
      })) as RawInventoryOpeningBalance;
      return { success: true, data: mapInventoryOpeningBalance(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  deleteInventoryOpeningBalance: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<void>> => {
    try {
      await invoke("delete_inventory_opening_balance", {
        id: input.id,
        companyId: input.companyId,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  finalizeInventoryOpeningBalances: async (input: {
    companyId: string;
    periodId: string;
  }): Promise<ApiResponse<void>> => {
    try {
      await invoke("finalize_inventory_opening_balances", {
        companyId: input.companyId,
        periodId: input.periodId,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const inventoryStocktakeApi = {
  getInventoryStocktakes: async (filters: {
    companyId: string;
    periodId: string;
  }): Promise<ApiResponse<InventoryStocktake[]>> => {
    try {
      const result = (await invoke("get_inventory_stocktakes", {
        companyId: filters.companyId,
        periodId: filters.periodId,
      })) as RawInventoryStocktake[];
      return { success: true, data: result.map(mapInventoryStocktake) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getInventoryStocktakeLines: async (filters: {
    stocktakeId: string;
    companyId: string;
  }): Promise<ApiResponse<InventoryStocktakeLine[]>> => {
    try {
      const result = (await invoke("get_inventory_stocktake_lines", {
        stocktakeId: filters.stocktakeId,
        companyId: filters.companyId,
      })) as RawInventoryStocktakeLine[];
      return { success: true, data: result.map(mapInventoryStocktakeLine) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createInventoryStocktake: async (input: {
    companyId: string;
    periodId: string;
    stocktakeDate: string;
    warehouseId: string;
    note?: string;
  }): Promise<ApiResponse<InventoryStocktake>> => {
    try {
      const result = (await invoke("create_inventory_stocktake", {
        input: {
          company_id: input.companyId,
          period_id: input.periodId,
          stocktake_date: input.stocktakeDate,
          warehouse_id: input.warehouseId,
          note: input.note || null,
        },
      })) as RawInventoryStocktake;
      return { success: true, data: mapInventoryStocktake(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  addInventoryStocktakeLine: async (input: {
    companyId: string;
    stocktakeId: string;
    inventoryItemId: string;
  }): Promise<ApiResponse<InventoryStocktakeLine>> => {
    try {
      const result = (await invoke("add_inventory_stocktake_line", {
        input: {
          company_id: input.companyId,
          stocktake_id: input.stocktakeId,
          inventory_item_id: input.inventoryItemId,
        },
      })) as RawInventoryStocktakeLine;
      return { success: true, data: mapInventoryStocktakeLine(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  saveInventoryStocktakeCount: async (input: {
    companyId: string;
    lineId: string;
    actualQuantity: number;
    actualUnitCost?: number;
    reason?: string;
  }): Promise<ApiResponse<InventoryStocktakeLine>> => {
    try {
      const result = (await invoke("save_inventory_stocktake_count", {
        input: {
          company_id: input.companyId,
          line_id: input.lineId,
          actual_quantity: input.actualQuantity,
          actual_unit_cost: input.actualUnitCost ?? null,
          reason: input.reason || null,
        },
      })) as RawInventoryStocktakeLine;
      return { success: true, data: mapInventoryStocktakeLine(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  confirmInventoryStocktake: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<InventoryStocktake>> => {
    try {
      const result = (await invoke("confirm_inventory_stocktake", {
        id: input.id,
        companyId: input.companyId,
      })) as RawInventoryStocktake;
      return { success: true, data: mapInventoryStocktake(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  voidInventoryStocktake: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<InventoryStocktake>> => {
    try {
      const result = (await invoke("void_inventory_stocktake", {
        id: input.id,
        companyId: input.companyId,
      })) as RawInventoryStocktake;
      return { success: true, data: mapInventoryStocktake(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const inventoryMovementApi = {
  getInventoryMovements: async (filters: {
    companyId: string;
    period: string;
  }): Promise<ApiResponse<InventoryMovement[]>> => {
    try {
      const result = (await invoke("get_inventory_movements", {
        companyId: filters.companyId,
        period: filters.period,
      })) as RawInventoryMovement[];
      return { success: true, data: result.map(mapInventoryMovement) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getInventoryStockBalances: async (filters: {
    companyId: string;
    throughPeriod: string;
  }): Promise<ApiResponse<InventoryStockBalance[]>> => {
    try {
      const result = (await invoke("get_inventory_stock_balances", {
        companyId: filters.companyId,
        throughPeriod: filters.throughPeriod,
      })) as RawInventoryStockBalance[];
      return { success: true, data: result.map(mapInventoryStockBalance) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createInventoryMovement: async (input: {
    companyId: string;
    period: string;
    movementDate: string;
    billNo: string;
    movementType: string;
    inventoryItemId: string;
    warehouseId: string;
    counterparty?: string;
    quantity: number;
    amount: number;
    sourceDocument?: string;
  }): Promise<ApiResponse<InventoryMovement>> => {
    try {
      const result = (await invoke("create_inventory_movement", {
        input: {
          company_id: input.companyId,
          period: input.period,
          movement_date: input.movementDate,
          bill_no: input.billNo,
          movement_type: input.movementType,
          inventory_item_id: input.inventoryItemId,
          warehouse_id: input.warehouseId,
          counterparty: input.counterparty,
          quantity: input.quantity,
          amount: input.amount,
          source_document: input.sourceDocument,
        },
      })) as RawInventoryMovement;
      return { success: true, data: mapInventoryMovement(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateInventoryMovement: async (input: {
    id: string;
    companyId: string;
    movementDate: string;
    billNo: string;
    movementType: string;
    inventoryItemId: string;
    warehouseId: string;
    counterparty?: string;
    quantity: number;
    amount: number;
    sourceDocument?: string;
  }): Promise<ApiResponse<InventoryMovement>> => {
    try {
      const result = (await invoke("update_inventory_movement", {
        input: {
          id: input.id,
          company_id: input.companyId,
          movement_date: input.movementDate,
          bill_no: input.billNo,
          movement_type: input.movementType,
          inventory_item_id: input.inventoryItemId,
          warehouse_id: input.warehouseId,
          counterparty: input.counterparty,
          quantity: input.quantity,
          amount: input.amount,
          source_document: input.sourceDocument,
        },
      })) as RawInventoryMovement;
      return { success: true, data: mapInventoryMovement(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  confirmInventoryMovement: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<InventoryMovement>> => {
    try {
      const result = (await invoke("confirm_inventory_movement", {
        id: input.id,
        companyId: input.companyId,
      })) as RawInventoryMovement;
      return { success: true, data: mapInventoryMovement(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createCostCarryoverFromInventoryMovement: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<CostCarryoverRecord>> => {
    try {
      const result = (await invoke(
        "create_cost_carryover_from_inventory_movement",
        { id: input.id, companyId: input.companyId },
      )) as RawCostCarryoverRecord;
      return { success: true, data: mapCostCarryoverRecord(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};
export const inventoryItemApi = {
  getInventoryItems: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<InventoryItem[]>> => {
    try {
      const result = (await invoke("get_inventory_items", {
        companyId: filters.companyId,
      })) as RawInventoryItem[];
      return { success: true, data: result.map(mapInventoryItem) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createInventoryItem: async (input: {
    companyId: string;
    itemCode: string;
    itemName: string;
    specification?: string;
    unitId: string;
    taxRate?: number;
    defaultSubject?: string;
    categoryId?: string;
    valuationMethod?: string;
    inventorySubject?: string;
    costSubject?: string;
    safetyStock?: number;
  }): Promise<ApiResponse<InventoryItem>> => {
    try {
      const result = (await invoke("create_inventory_item", {
        input: {
          company_id: input.companyId,
          item_code: input.itemCode,
          item_name: input.itemName,
          specification: input.specification,
          unit_id: input.unitId,
          tax_rate: input.taxRate,
          default_subject: input.defaultSubject,
          category_id: input.categoryId,
          valuation_method: input.valuationMethod,
          inventory_subject: input.inventorySubject,
          cost_subject: input.costSubject,
          safety_stock: input.safetyStock,
        },
      })) as RawInventoryItem;
      return { success: true, data: mapInventoryItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateInventoryItem: async (input: {
    id: string;
    companyId: string;
    itemCode: string;
    itemName: string;
    specification?: string;
    unitId: string;
    taxRate?: number;
    defaultSubject?: string;
    categoryId?: string;
    valuationMethod?: string;
    inventorySubject?: string;
    costSubject?: string;
    safetyStock?: number;
  }): Promise<ApiResponse<InventoryItem>> => {
    try {
      const result = (await invoke("update_inventory_item", {
        input: {
          id: input.id,
          company_id: input.companyId,
          item_code: input.itemCode,
          item_name: input.itemName,
          specification: input.specification,
          unit_id: input.unitId,
          tax_rate: input.taxRate,
          default_subject: input.defaultSubject,
          category_id: input.categoryId,
          valuation_method: input.valuationMethod,
          inventory_subject: input.inventorySubject,
          cost_subject: input.costSubject,
          safety_stock: input.safetyStock,
        },
      })) as RawInventoryItem;
      return { success: true, data: mapInventoryItem(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};
export const measurementUnitApi = {
  getMeasurementUnits: async (filters: {
    companyId: string;
  }): Promise<ApiResponse<MeasurementUnit[]>> => {
    try {
      const result = (await invoke("get_measurement_units", {
        companyId: filters.companyId,
      })) as RawMeasurementUnit[];
      return { success: true, data: result.map(mapMeasurementUnit) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  createMeasurementUnit: async (input: {
    companyId: string;
    unitName: string;
    unitGroup?: string;
    baseUnit?: string;
    conversionRate: number;
    precisionDigits: number;
    remark?: string;
  }): Promise<ApiResponse<MeasurementUnit>> => {
    try {
      const result = (await invoke("create_measurement_unit", {
        input: {
          company_id: input.companyId,
          unit_name: input.unitName,
          unit_group: input.unitGroup,
          base_unit: input.baseUnit,
          conversion_rate: input.conversionRate,
          precision_digits: input.precisionDigits,
          remark: input.remark,
        },
      })) as RawMeasurementUnit;
      return { success: true, data: mapMeasurementUnit(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  updateMeasurementUnit: async (input: {
    id: string;
    companyId: string;
    unitName: string;
    unitGroup?: string;
    baseUnit?: string;
    conversionRate: number;
    precisionDigits: number;
    remark?: string;
  }): Promise<ApiResponse<MeasurementUnit>> => {
    try {
      const result = (await invoke("update_measurement_unit", {
        input: {
          id: input.id,
          company_id: input.companyId,
          unit_name: input.unitName,
          unit_group: input.unitGroup,
          base_unit: input.baseUnit,
          conversion_rate: input.conversionRate,
          precision_digits: input.precisionDigits,
          remark: input.remark,
        },
      })) as RawMeasurementUnit;
      return { success: true, data: mapMeasurementUnit(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};

export const reportSnapshotApi = {
  publishReportSnapshot: async (input: {
    companyId: string;
    periodId: string;
    reportType: string;
  }): Promise<ApiResponse<ReportSnapshot>> => {
    try {
      const result = (await invoke(
        "publish_report_snapshot",
        input,
      )) as RawReportSnapshot;
      return { success: true, data: mapReportSnapshot(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getReportSnapshots: async (filters: {
    companyId: string;
    periodId: string;
    reportType: string;
  }): Promise<ApiResponse<ReportSnapshot[]>> => {
    try {
      const result = (await invoke(
        "get_report_snapshots",
        filters,
      )) as RawReportSnapshot[];
      return { success: true, data: result.map(mapReportSnapshot) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
  getReportSnapshot: async (input: {
    id: string;
    companyId: string;
  }): Promise<ApiResponse<ReportSnapshot>> => {
    try {
      const result = (await invoke(
        "get_report_snapshot",
        input,
      )) as RawReportSnapshot;
      return { success: true, data: mapReportSnapshot(result) };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};
