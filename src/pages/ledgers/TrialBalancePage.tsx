import { Alert, Card, Empty, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { AccountingPeriodPicker } from '../../components/AccountingPeriodPicker'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { TrialBalance, TrialBalanceRow } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { getIdleFinancialPageState, getLoadingFinancialPageState, resetFinancialPageState } from '../financialPageState'

const columns: ColumnsType<TrialBalanceRow> = [
  { title: '科目编码', dataIndex: 'accountCode', key: 'accountCode', width: 120 },
  { title: '科目名称', dataIndex: 'accountName', key: 'accountName', width: 180 },
  {
    title: '期初借方',
    dataIndex: 'openingDebit',
    key: 'openingDebit',
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
  {
    title: '期初贷方',
    dataIndex: 'openingCredit',
    key: 'openingCredit',
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
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

const emptyTrialBalance: TrialBalance = {
  rows: [],
  totalDebit: 0,
  totalCredit: 0,
}

export function TrialBalancePage() {
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [trialBalance, setTrialBalance] = useState<TrialBalance>(emptyTrialBalance)

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      const nextState = getIdleFinancialPageState(emptyTrialBalance)
      setLoading(nextState.loading)
      setTrialBalance(emptyTrialBalance)
      setErrorMessage(nextState.errorMessage)
      return
    }

    let cancelled = false
    const nextState = getLoadingFinancialPageState(emptyTrialBalance)

    void (async () => {
      setLoading(nextState.loading)
      setTrialBalance(nextState.data)
      setErrorMessage(null)

      try {
        const response = await accountingApi.getTrialBalance({
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
        })

        if (!cancelled) {
          setTrialBalance(response)
        }
      } catch (error) {
        if (!cancelled) {
          const nextState = resetFinancialPageState(emptyTrialBalance, error, '科目余额表加载失败')
          setTrialBalance(nextState.data)
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
        title="科目余额表"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '请选择会计期间后查看科目余额表'
        }
        extra={
          <Space wrap>
            <AccountingPeriodPicker />
            <ExportActions
              title="科目余额表"
              onExport={(format) =>
                accountingApi.exportDocument({
                  type: 'ledger',
                  format,
                  title: '科目余额表',
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
          <Table<TrialBalanceRow>
            columns={columns}
            dataSource={trialBalance.rows}
            loading={loading}
            pagination={false}
            rowKey="accountCode"
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                <Table.Summary.Cell index={1} />
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} align="right">
                  <AmountText value={trialBalance.totalDebit} />
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <AmountText value={trialBalance.totalCredit} />
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} />
                <Table.Summary.Cell index={7} />
              </Table.Summary.Row>
            )}
          />
        </Card>
      )}
    </Space>
  )
}
