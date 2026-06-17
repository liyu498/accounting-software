import { Alert, Card, Empty, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { AccountingPeriodPicker } from '../../components/AccountingPeriodPicker'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { BalanceSheet, ReportRow } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'

const columns: ColumnsType<ReportRow> = [
  { title: '行次', dataIndex: 'lineNumber', key: 'lineNumber', width: 100 },
  { title: '项目', dataIndex: 'item', key: 'item' },
  {
    title: '金额',
    dataIndex: 'amount',
    key: 'amount',
    width: 180,
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
]

const emptyBalanceSheet: BalanceSheet = {
  assets: [],
  liabilitiesAndEquity: [],
}

export function BalanceSheetPage() {
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [report, setReport] = useState<BalanceSheet>(emptyBalanceSheet)

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setReport(emptyBalanceSheet)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const response = await accountingApi.getBalanceSheet({
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
        })

        if (!cancelled) {
          setReport(response)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '资产负债表加载失败')
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

  async function handleExport(format: 'excel' | 'pdf') {
    if (!selectedCompany || !selectedPeriodId) {
      return
    }

    try {
      const result = await accountingApi.exportDocument({
        type: 'report',
        format,
        title: '资产负债表',
      })
      message.success(result.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败')
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title="资产负债表"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '请选择会计期间后查看资产负债表'
        }
        extra={
          <Space wrap>
            <AccountingPeriodPicker />
            <ExportActions title="资产负债表" onExport={handleExport} />
          </Space>
        }
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      {!selectedPeriodId ? (
        <Card>
          <Empty description="请选择会计期间" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ display: 'flex' }}>
          <Card title="资产">
            <Table<ReportRow>
              columns={columns}
              dataSource={report.assets}
              loading={loading}
              pagination={false}
              rowKey={(row) => `asset-${row.lineNumber}`}
            />
          </Card>
          <Card title="负债和所有者权益">
            <Table<ReportRow>
              columns={columns}
              dataSource={report.liabilitiesAndEquity}
              loading={loading}
              pagination={false}
              rowKey={(row) => `liability-${row.lineNumber}`}
            />
          </Card>
        </Space>
      )}
    </Space>
  )
}
