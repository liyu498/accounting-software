import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  RollbackOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Alert, Button, DatePicker, Form, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { isVoucherEditable } from '../../features/vouchers/voucherRules'
import { accountingApi } from '../../services/accountingApi'
import type { VoucherStatus, VoucherSummary } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { buildVoucherListQuery, type VoucherListFilters } from './voucherListQuery'

type FilterValues = VoucherListFilters

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '已审核', value: 'approved' },
  { label: '已红冲', value: 'reversed' },
]

const statusLabels: Record<VoucherStatus, string> = {
  draft: '草稿',
  approved: '已审核',
  reversed: '已红冲',
}

function statusColor(status: VoucherStatus) {
  switch (status) {
    case 'approved':
      return 'green'
    case 'reversed':
      return 'red'
    default:
      return 'gold'
  }
}

export function VoucherListPage() {
  const navigate = useNavigate()
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [form] = Form.useForm<FilterValues>()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [items, setItems] = useState<VoucherSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<FilterValues>({ status: 'all' })
  const [refreshToken, setRefreshToken] = useState(0)

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )
  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setItems([])
      setTotal(0)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)

      const query = buildVoucherListQuery({
        companyId: selectedCompany.id,
        periodId: selectedPeriodId,
        page,
        pageSize,
        filters,
      })

      try {
        const response = await accountingApi.listVouchers(query)

        if (!cancelled) {
          setItems(response.items)
          setTotal(response.total)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '凭证列表加载失败')
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
  }, [filters, page, pageSize, refreshToken, selectedCompany, selectedPeriodId])

  function refreshList() {
    setRefreshToken((value) => value + 1)
  }

  async function handleAudit(id: string) {
    try {
      await accountingApi.auditVoucher(id)
      message.success('凭证已审核')
      refreshList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '审核失败')
    }
  }

  async function handleReverseAudit(id: string) {
    try {
      await accountingApi.reverseAuditVoucher(id)
      message.success('已反审核凭证')
      refreshList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '反审核失败')
    }
  }

  async function handleRedReversal(id: string) {
    try {
      const reversal = await accountingApi.createRedReversal(id)
      message.success(`已生成红字冲销凭证 ${reversal.voucherNumber}`)
      refreshList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '红字冲销失败')
    }
  }

  const columns: ColumnsType<VoucherSummary> = [
    { title: '日期', dataIndex: 'voucherDate', key: 'voucherDate', width: 120 },
    { title: '凭证号', dataIndex: 'voucherNumber', key: 'voucherNumber', width: 130 },
    { title: '摘要', dataIndex: 'summary', key: 'summary' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: VoucherStatus) => <Tag color={statusColor(status)}>{statusLabels[status]}</Tag>,
    },
    {
      title: '借方',
      dataIndex: 'debitTotal',
      key: 'debitTotal',
      width: 140,
      align: 'right',
      render: (value: number) => <AmountText value={value} />,
    },
    {
      title: '贷方',
      dataIndex: 'creditTotal',
      key: 'creditTotal',
      width: 140,
      align: 'right',
      render: (value: number) => <AmountText value={value} />,
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            icon={<EyeOutlined />}
            onClick={() => {
              navigate(`/vouchers/${record.id}`)
            }}
            size="small"
          >
            查看
          </Button>
          <Button
            disabled={!isVoucherEditable(record.status)}
            icon={<EditOutlined />}
            onClick={() => {
              navigate(`/vouchers/${record.id}/edit`)
            }}
            size="small"
          >
            编辑
          </Button>
          {record.status === 'draft' ? (
            <Popconfirm
              cancelText="取消"
              okText="确认"
              onConfirm={() => {
                void handleAudit(record.id)
              }}
              title="确认审核这张凭证吗？"
            >
              <Button icon={<CheckCircleOutlined />} size="small" type="link">
                审核
              </Button>
            </Popconfirm>
          ) : null}
          {record.status === 'approved' ? (
            <>
              <Popconfirm
                cancelText="取消"
                okText="确认"
                onConfirm={() => {
                  void handleReverseAudit(record.id)
                }}
                title="确认反审核这张凭证吗？"
              >
                <Button icon={<RollbackOutlined />} size="small" type="link">
                  反审核
                </Button>
              </Popconfirm>
              <Popconfirm
                cancelText="取消"
                okText="确认"
                onConfirm={() => {
                  void handleRedReversal(record.id)
                }}
                title="确认生成红字冲销凭证吗？"
              >
                <Button danger icon={<StopOutlined />} size="small" type="link">
                  红字冲销
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title="凭证"
        subtitle={
          selectedCompany && selectedPeriod
            ? `${selectedCompany.name} · ${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}`
            : '请选择账套和会计期间后再查看凭证'
        }
        extra={
          <Space>
            <ExportActions
              title="凭证列表"
              onExport={(format) =>
                accountingApi.exportDocument({
                  type: 'voucher',
                  format,
                  title: '凭证列表',
                })
              }
            />
            <Button
              icon={<FileAddOutlined />}
              onClick={() => {
                navigate('/vouchers/new')
              }}
              type="primary"
            >
              新建凭证
            </Button>
          </Space>
        }
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      <Form
        form={form}
        initialValues={{ status: 'all' }}
        layout="inline"
        onFinish={(values) => {
          const nextFilters: FilterValues = {
            keyword: values.keyword,
            status: values.status ?? 'all',
            voucherDate: values.voucherDate ?? null,
          }

          setPage(1)
          setFilters(nextFilters)
        }}
      >
        <Form.Item name="keyword">
          <Input.Search allowClear enterButton placeholder="搜索摘要、凭证号" style={{ width: 240 }} />
        </Form.Item>
        <Form.Item name="status">
          <Select options={statusOptions} style={{ width: 140 }} />
        </Form.Item>
        <Form.Item name="voucherDate">
          <DatePicker allowClear placeholder="凭证日期" />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button htmlType="submit" type="primary">
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields()
                setPage(1)
                setFilters({ status: 'all' })
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <Table<VoucherSummary>
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 张凭证`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage)
            setPageSize(nextPageSize)
          },
        }}
        rowKey="id"
      />
    </Space>
  )
}
