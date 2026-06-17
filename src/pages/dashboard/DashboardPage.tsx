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

type DashboardData = {
  vouchers: VoucherSummary[]
  total: number
}

const statusLabels: Record<VoucherSummary['status'], string> = {
  draft: '鑽夌',
  approved: '宸插鏍?',
  reversed: '宸茬孩瀛?',
}

const columns: ColumnsType<VoucherSummary> = [
  { title: '鏃ユ湡', dataIndex: 'voucherDate', key: 'voucherDate', width: 120 },
  { title: '鍑瘉鍙?', dataIndex: 'voucherNumber', key: 'voucherNumber', width: 140 },
  { title: '鎽樿', dataIndex: 'summary', key: 'summary' },
  {
    title: '鐘舵€?',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (status: VoucherSummary['status']) => (
      <Tag color={status === 'approved' ? 'green' : status === 'reversed' ? 'red' : 'gold'}>{statusLabels[status]}</Tag>
    ),
  },
  {
    title: '鍊熸柟',
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
  const [data, setData] = useState<DashboardData>({ vouchers: [], total: 0 })

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setData({ vouchers: [], total: 0 })
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      try {
        const result = await accountingApi.listVouchers({
          companyId: selectedCompany.id,
          periodId: selectedPeriodId,
          page: 1,
          pageSize: 20,
        })

        if (!cancelled) {
          setData({ vouchers: result.items, total: result.total })
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '浠〃鏁版嵁鍔犺浇澶辫触')
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

  const approvedCount = data.vouchers.filter((voucher) => voucher.status === 'approved').length
  const draftCount = data.vouchers.filter((voucher) => voucher.status === 'draft').length

  return (
    <Space className="dashboard-page" direction="vertical" size={24}>
      <PageHeaderBar
        title="Dashboard"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '鏈€夋嫨璐﹀鎴栨湡闂?'
        }
        extra={<ExportActions title="Dashboard" type="report" />}
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic prefix={<FileTextOutlined />} title="鍑瘉鎬绘暟" value={data.total} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic prefix={<CheckCircleOutlined />} title="宸插鏍?" value={approvedCount} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic prefix={<ClockCircleOutlined />} title="鑽夌" value={draftCount} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={10}>
          <Card title="蹇€熸搷浣?">
            <List
              dataSource={[
                {
                  key: 'vouchers',
                  title: '鍒涘缓鍑瘉',
                  description: '杩涘叆鍑瘉鍒楄〃锛岀户缁綋鏈熷綍鍏ャ€?',
                  icon: <FileAddOutlined />,
                  path: '/vouchers',
                },
                {
                  key: 'trial-balance',
                  title: '鏌ョ湅绉戠洰浣欓琛?',
                  description: '鏍稿鍊熻捶骞宠　鍜岀粨浣欐儏鍐点€?',
                  icon: <ArrowRightOutlined />,
                  path: '/ledgers/trial-balance',
                },
                {
                  key: 'income-statement',
                  title: '鏌ョ湅鍒╂鼎琛?',
                  description: '蹇€熺‘璁ゆ湰鏈熸敹鍏ヤ笌鎹熺泭銆?',
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
                      鎵撳紑
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
          <Card title="褰撴湡淇℃伅">
            <Space className="dashboard-current" direction="vertical" size={8}>
              <Typography.Text>璐﹀锛?{selectedCompany?.name ?? '鏈€夋嫨'}</Typography.Text>
              <Typography.Text>
                浼氳鏈熼棿锛?{selectedPeriod ? `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}` : '鏈€夋嫨'}
              </Typography.Text>
              <Typography.Text>褰撳墠鍑瘉鏁帮細{data.total}</Typography.Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="鏈€杩戝嚟璇?">
        {data.vouchers.length > 0 ? (
          <Table<VoucherSummary> columns={columns} dataSource={data.vouchers} loading={loading} pagination={false} rowKey="id" />
        ) : (
          <Empty description="褰撳墠鏈熼棿鏆傛棤鍑瘉" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </Space>
  )
}
