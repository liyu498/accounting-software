import { Alert, Card, Empty, Select, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { AccountingPeriodPicker } from '../../components/AccountingPeriodPicker'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { LedgerEntry, SubsidiaryLedger } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { resetFinancialPageState } from '../financialPageState'

type SubsidiaryRow = SubsidiaryLedger[number]

const ledgerColumns: ColumnsType<SubsidiaryRow> = [
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

export function SubsidiaryLedgerPage() {
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rows, setRows] = useState<SubsidiaryLedger>([])
  const [accountCode, setAccountCode] = useState<string | undefined>()

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  const accountOptions = useMemo(
    () =>
      rows.map((row) => ({
        label: `${row.accountCode} ${row.accountName}`,
        value: row.accountCode,
      })),
    [rows],
  )

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setRows([])
      setErrorMessage(null)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const response = await accountingApi.getSubsidiaryLedger({
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
          accountCode,
        })

        if (!cancelled) {
          setRows(response)
        }
      } catch (error) {
        if (!cancelled) {
          const nextState = resetFinancialPageState<SubsidiaryLedger>([], error, '明细账加载失败')
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
  }, [accountCode, selectedCompany, selectedPeriodId])

  async function handleExport(format: 'excel' | 'pdf') {
    if (!selectedCompany || !selectedPeriodId) {
      return
    }

    try {
      const result = await accountingApi.exportDocument({
        type: 'ledger',
        format,
        title: accountCode ? `明细账-${accountCode}` : '明细账',
      })
      message.success(result.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败')
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title="明细账"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '请选择会计期间后查看明细账'
        }
        extra={
          <Space wrap>
            <AccountingPeriodPicker />
            <Select
              allowClear
              options={accountOptions}
              placeholder="筛选科目"
              style={{ width: 220 }}
              value={accountCode}
              onChange={(value) => {
                setAccountCode(value)
              }}
            />
            <ExportActions title="明细账" onExport={handleExport} />
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
          <Table<SubsidiaryRow>
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
