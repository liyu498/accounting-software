import { Alert, Card, Empty, Space, Table, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { AccountingPeriodPicker } from '../../components/AccountingPeriodPicker'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { IncomeStatement, ReportRow } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { resetFinancialPageState } from '../financialPageState'

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

const emptyIncomeStatement: IncomeStatement = {
  rows: [],
}

export function IncomeStatementPage() {
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [report, setReport] = useState<IncomeStatement>(emptyIncomeStatement)

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setReport(emptyIncomeStatement)
      setErrorMessage(null)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const response = await accountingApi.getIncomeStatement({
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
        })

        if (!cancelled) {
          setReport(response)
        }
      } catch (error) {
        if (!cancelled) {
          const nextState = resetFinancialPageState(emptyIncomeStatement, error, '利润表加载失败')
          setReport(nextState.data)
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

  async function handleExport(format: 'excel' | 'pdf') {
    if (!selectedCompany || !selectedPeriodId) {
      return
    }

    try {
      const result = await accountingApi.exportDocument({
        type: 'report',
        format,
        title: '利润表',
      })
      message.success(result.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '导出失败')
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title="利润表"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '请选择会计期间后查看利润表'
        }
        extra={
          <Space wrap>
            <AccountingPeriodPicker />
            <ExportActions title="利润表" onExport={handleExport} />
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
          <Table<ReportRow>
            columns={columns}
            dataSource={report.rows}
            loading={loading}
            pagination={false}
            rowKey={(row) => row.lineNumber}
          />
        </Card>
      )}
    </Space>
  )
}
