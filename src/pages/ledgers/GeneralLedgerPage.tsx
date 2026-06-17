import { Alert, Card, Empty, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { AccountingPeriodPicker } from '../../components/AccountingPeriodPicker'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { GeneralLedger, GeneralLedgerRow, LedgerEntry } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { getIdleFinancialPageState, getLoadingFinancialPageState, resetFinancialPageState } from '../financialPageState'

const ledgerColumns: ColumnsType<GeneralLedgerRow> = [
  { title: '科目编码', dataIndex: 'accountCode', key: 'accountCode', width: 120 },
  { title: '科目名称', dataIndex: 'accountName', key: 'accountName', width: 180 },
  {
    title: '本期借方',
    dataIndex: 'periodDebit',
    key: 'periodDebit',
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
  {
    title: '本期贷方',
    dataIndex: 'periodCredit',
    key: 'periodCredit',
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
  {
    title: '期末借方',
    dataIndex: 'closingDebit',
    key: 'closingDebit',
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
  {
    title: '期末贷方',
    dataIndex: 'closingCredit',
    key: 'closingCredit',
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
]

const entryColumns: ColumnsType<LedgerEntry> = [
  { title: '日期', dataIndex: 'voucherDate', key: 'voucherDate', width: 120 },
  { title: '凭证号', dataIndex: 'voucherNumber', key: 'voucherNumber', width: 140 },
  { title: '摘要', dataIndex: 'summary', key: 'summary' },
  {
    title: '借方',
    dataIndex: 'debit',
    key: 'debit',
    width: 140,
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
  {
    title: '贷方',
    dataIndex: 'credit',
    key: 'credit',
    width: 140,
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
  {
    title: '余额',
    dataIndex: 'balance',
    key: 'balance',
    width: 140,
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
]

export function GeneralLedgerPage() {
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rows, setRows] = useState<GeneralLedger>([])

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      const nextState = getIdleFinancialPageState<GeneralLedger>([])
      setLoading(nextState.loading)
      setRows([])
      setErrorMessage(nextState.errorMessage)
      return
    }

    let cancelled = false
    const nextState = getLoadingFinancialPageState<GeneralLedger>([])

    void (async () => {
      setLoading(nextState.loading)
      setRows(nextState.data)
      setErrorMessage(null)

      try {
        const response = await accountingApi.getGeneralLedger({
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
        })

        if (!cancelled) {
          setRows(response)
        }
      } catch (error) {
        if (!cancelled) {
          const nextState = resetFinancialPageState<GeneralLedger>([], error, '总账加载失败')
          setRows(nextState.data)
          setErrorMessage(nextState.errorMessage)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedCompany, selectedPeriodId])

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title="总账"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '请选择会计期间后查看总账'
        }
        extra={
          <Space wrap>
            <AccountingPeriodPicker />
            <ExportActions
              title="总账"
              onExport={(format) =>
                accountingApi.exportDocument({
                  type: 'ledger',
                  format,
                  title: '总账',
                })
              }
            />
          </Space>
        }
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      {!selectedPeriodId ? (
        <Card>
          <Empty description="请选择会计期间" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <Card>
          <Table<GeneralLedgerRow>
            columns={ledgerColumns}
            dataSource={rows}
            expandable={{
              expandedRowRender: (record) => (
                <Table<LedgerEntry>
                  columns={entryColumns}
                  dataSource={record.entries}
                  pagination={false}
                  rowKey={(entry) => `${record.accountCode}-${entry.voucherNumber}-${entry.summary}`}
                  size="small"
                />
              ),
              rowExpandable: (record) => record.entries.length > 0,
            }}
            loading={loading}
            pagination={false}
            rowKey="accountCode"
          />
        </Card>
      )}
    </Space>
  )
}
