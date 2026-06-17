import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileAddOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Col, Empty, List, Row, Space, Statistic, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { VoucherSummary } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { loadDashboardData, type DashboardData } from './dashboardData'

const emptyDashboardData: DashboardData = {
  recentVouchers: [],
  total: 0,
  approvedCount: 0,
  draftCount: 0,
}

const statusLabels: Record<VoucherSummary['status'], string> = {
  draft: '草稿',
  approved: '已审核',
  reversed: '已红冲',
}

const columns: ColumnsType<VoucherSummary> = [
  { title: '日期', dataIndex: 'voucherDate', key: 'voucherDate', width: 120 },
  { title: '凭证号', dataIndex: 'voucherNumber', key: 'voucherNumber', width: 140 },
  { title: '摘要', dataIndex: 'summary', key: 'summary' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (status: VoucherSummary['status']) => (
      <Tag color={status === 'approved' ? 'green' : status === 'reversed' ? 'red' : 'gold'}>{statusLabels[status]}</Tag>
    ),
  },
  {
    title: '借方',
    dataIndex: 'debitTotal',
    key: 'debitTotal',
    width: 140,
    align: 'right',
    render: (value: number) => <AmountText value={value} />,
  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData>(emptyDashboardData)

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setData(emptyDashboardData)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const result = await loadDashboardData(accountingApi, {
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
        })

        if (!cancelled) {
          setData(result)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '工作台数据加载失败')
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

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  return (
    <Space className="dashboard-page" direction="vertical" size={24}>
      <PageHeaderBar
        title="工作台"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '当前账套或当前期间未选择'
        }
        extra={<ExportActions title="工作台" type="report" />}
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic prefix={<FileTextOutlined />} title="凭证总数" value={data.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic prefix={<CheckCircleOutlined />} title="已审核" value={data.approvedCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic prefix={<ClockCircleOutlined />} title="草稿" value={data.draftCount} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={10}>
          <Card title="快捷操作">
            <List
              dataSource={[
                {
                  key: 'new-voucher',
                  title: '新建凭证',
                  description: '继续录入本期业务凭证。',
                  icon: <FileAddOutlined />,
                  path: '/vouchers',
                },
                {
                  key: 'view-vouchers',
                  title: '查看凭证',
                  description: '查看最近录入与待处理凭证。',
                  icon: <ArrowRightOutlined />,
                  path: '/vouchers',
                },
                {
                  key: 'view-reports',
                  title: '查看报表',
                  description: '打开利润表与资产负债表。',
                  icon: <ArrowRightOutlined />,
                  path: '/reports/income-statement',
                },
              ]}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key={item.key}
                      onClick={() => {
                        navigate(item.path)
                      }}
                      type="link"
                    >
                      打开
                    </Button>,
                  ]}
                >
                  <List.Item.Meta avatar={item.icon} description={item.description} title={item.title} />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={14}>
          <Card title="当前账套">
            <Space className="dashboard-current" direction="vertical" size={8}>
              <Typography.Text>当前账套：{selectedCompany?.name ?? '未选择'}</Typography.Text>
              <Typography.Text>
                当前期间：{selectedPeriod ? `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}` : '未选择'}
              </Typography.Text>
              <Typography.Text>凭证总数：{data.total}</Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="最近凭证">
        {data.recentVouchers.length > 0 ? (
          <Table<VoucherSummary>
            columns={columns}
            dataSource={data.recentVouchers}
            loading={loading}
            pagination={false}
            rowKey="id"
          />
        ) : (
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </Space>
  )
}
