import {
  CheckCircleOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileAddOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Alert, Button, Checkbox, DatePicker, Form, Input, Popconfirm, Select, Space, Table, Tag, Tooltip, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { isVoucherEditable } from '../../features/vouchers/voucherRules'
import { accountingApi } from '../../services/accountingApi'
import type { VoucherDetail, VoucherEntry, VoucherStatus, VoucherSummary } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { buildVoucherListQuery, type VoucherListFilters } from './voucherListQuery'

type FilterValues = VoucherListFilters

type VoucherGridRow = {
  key: string
  voucher: VoucherDetail
  entry: VoucherEntry
  entryIndex: number
  rowSpan: number
}

type EntryFilterKey =
  | 'customerSupplier'
  | 'account'
  | 'asset'
  | 'inventory'
  | 'department'
  | 'project'
  | 'tag'
  | 'cashFlow'

type EntryFilterOption = {
  key: EntryFilterKey
  label: string
  matches: (row: { voucher: VoucherDetail; entry: VoucherEntry }) => boolean
}

const emptyVoucherPage = {
  items: [] as VoucherDetail[],
  total: 0,
}

const entryFilterOptions: EntryFilterOption[] = [
  {
    key: 'customerSupplier',
    label: '客户/供应商',
    matches: ({ entry }) => entry.accountCode.startsWith('22'),
  },
  {
    key: 'account',
    label: '账户',
    matches: ({ entry }) => ['1001', '1002'].includes(entry.accountCode),
  },
  {
    key: 'asset',
    label: '资产',
    matches: ({ entry }) => entry.accountCode.startsWith('1'),
  },
  {
    key: 'inventory',
    label: '存货',
    matches: ({ entry }) => entry.accountCode.startsWith('14'),
  },
  {
    key: 'department',
    label: '部门',
    matches: ({ entry }) => /工资|社保|个税|管理费用/.test(entry.summary + entry.accountName),
  },
  {
    key: 'project',
    label: '项目',
    matches: ({ entry }) => entry.accountCode.startsWith('6'),
  },
  {
    key: 'tag',
    label: '标签',
    matches: () => false,
  },
  {
    key: 'cashFlow',
    label: '现金流量项目',
    matches: ({ entry }) => ['1001', '1002'].includes(entry.accountCode),
  },
]

const defaultEntryFilterKeys = entryFilterOptions.map((option) => option.key)

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

function formatVoucherNo(voucherNumber: string) {
  return voucherNumber.replace('-', '')
}

function buildVoucherRows(vouchers: VoucherDetail[], activeFilterKeys: EntryFilterKey[]): VoucherGridRow[] {
  const activeFilters = entryFilterOptions.filter((option) => activeFilterKeys.includes(option.key))

  return vouchers.flatMap((voucher) =>
    voucher.entries
      .filter((entry) => {
        if (activeFilters.length === 0) {
          return true
        }

        return activeFilters.some((filter) => filter.matches({ voucher, entry }))
      })
      .map((entry, entryIndex, visibleEntries) => ({
      key: `${voucher.id}-${entry.id}`,
      voucher,
      entry,
      entryIndex,
      rowSpan: entryIndex === 0 ? visibleEntries.length : 0,
    })),
  )
}

export function VoucherListPage() {
  const navigate = useNavigate()
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const periods = useCompanyStore((state) => state.periods)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [form] = Form.useForm<FilterValues>()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [items, setItems] = useState<VoucherDetail[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [filters, setFilters] = useState<FilterValues>({ status: 'all' })
  const [refreshToken, setRefreshToken] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const [hoveredVoucherId, setHoveredVoucherId] = useState<string | null>(null)
  const [activeEntryFilterKeys, setActiveEntryFilterKeys] = useState<EntryFilterKey[]>(defaultEntryFilterKeys)

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  const rows = useMemo(() => buildVoucherRows(items, activeEntryFilterKeys), [activeEntryFilterKeys, items])
  const selectedVoucher = useMemo(
    () => items.find((item) => item.id === selectedVoucherId) ?? items[0] ?? null,
    [items, selectedVoucherId],
  )

  useEffect(() => {
    if (!selectedCompany || !selectedPeriodId) {
      setItems(emptyVoucherPage.items)
      setTotal(emptyVoucherPage.total)
      setSelectedVoucherId(null)
      setErrorMessage(null)
      setLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setItems(emptyVoucherPage.items)
      setTotal(emptyVoucherPage.total)
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
        const details = await Promise.all(response.items.map((voucher: VoucherSummary) => accountingApi.getVoucher(voucher.id)))

        if (!cancelled) {
          setItems(details)
          setTotal(response.total)
          setSelectedVoucherId((current) => {
            if (current && details.some((item) => item.id === current)) {
              return current
            }
            return details[0]?.id ?? null
          })
        }
      } catch (error) {
        if (!cancelled) {
          setItems(emptyVoucherPage.items)
          setTotal(emptyVoucherPage.total)
          setSelectedVoucherId(null)
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

  function requireSelectedVoucher() {
    if (!selectedVoucher) {
      message.warning('请先选择凭证')
      return null
    }
    return selectedVoucher
  }

  async function handleAudit(id?: string) {
    const target = id ? items.find((item) => item.id === id) : requireSelectedVoucher()
    if (!target) {
      return
    }

    try {
      await accountingApi.auditVoucher(target.id)
      message.success('凭证已审核')
      refreshList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '审核失败')
    }
  }

  async function handleReverseAudit(id?: string) {
    const target = id ? items.find((item) => item.id === id) : requireSelectedVoucher()
    if (!target) {
      return
    }

    try {
      await accountingApi.reverseAuditVoucher(target.id)
      message.success('已反审核凭证')
      refreshList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '反审核失败')
    }
  }

  async function handleRedReversal(id?: string) {
    const target = id ? items.find((item) => item.id === id) : requireSelectedVoucher()
    if (!target) {
      return
    }

    try {
      const reversal = await accountingApi.createRedReversal(target.id)
      message.success(`已生成红字冲销凭证 ${reversal.voucherNumber}`)
      refreshList()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '红字冲销失败')
    }
  }

  const columns: ColumnsType<VoucherGridRow> = [
    {
      title: <Checkbox aria-label="全选凭证" />,
      key: 'select',
      width: 38,
      align: 'center',
      fixed: 'left',
      render: (_, row) => ({
        children: (
          <Checkbox
            aria-label={`选择${row.voucher.voucherNumber}`}
            checked={selectedVoucherId === row.voucher.id}
            onChange={() => {
              setSelectedVoucherId(row.voucher.id)
            }}
          />
        ),
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '凭证日期',
      key: 'voucherDate',
      width: 116,
      fixed: 'left',
      sorter: (a, b) => a.voucher.voucherDate.localeCompare(b.voucher.voucherDate),
      render: (_, row) => ({
        children: row.voucher.voucherDate,
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '凭证字号',
      key: 'voucherNumber',
      width: 104,
      fixed: 'left',
      sorter: (a, b) => a.voucher.voucherNumber.localeCompare(b.voucher.voucherNumber),
      render: (_, row) => ({
        children: (
          <button
            className="voucher-no-button"
            type="button"
            onClick={() => {
              navigate(`/vouchers/${row.voucher.id}`)
            }}
          >
            {formatVoucherNo(row.voucher.voucherNumber)}
          </button>
        ),
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '摘要',
      dataIndex: ['entry', 'summary'],
      key: 'summary',
      width: 360,
      ellipsis: true,
      render: (_, row) => row.entry.summary,
    },
    {
      title: '科目',
      key: 'account',
      width: 280,
      ellipsis: true,
      render: (_, row) => `${row.entry.accountCode} ${row.entry.accountName}`,
    },
    {
      title: '借方',
      key: 'debit',
      width: 126,
      align: 'right',
      render: (_, row) => (row.entry.debit ? <AmountText value={row.entry.debit} /> : null),
    },
    {
      title: '贷方',
      key: 'credit',
      width: 126,
      align: 'right',
      render: (_, row) => (row.entry.credit ? <AmountText value={row.entry.credit} /> : null),
    },
    {
      title: '制单人',
      key: 'createdBy',
      width: 96,
      render: (_, row) => ({
        children: row.voucher.createdBy,
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '审核人',
      key: 'auditor',
      width: 96,
      render: (_, row) => ({
        children: row.voucher.status === 'approved' ? row.voucher.createdBy : '',
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '附件张数',
      key: 'attachmentCount',
      width: 92,
      align: 'center',
      render: (_, row) => ({
        children: <span className="voucher-attachment-count">{row.voucher.attachmentCount}</span>,
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '数据来源',
      key: 'source',
      width: 120,
      render: (_, row) => ({
        children: row.voucher.status === 'draft' ? '手工录入' : '进项发票',
        props: { rowSpan: row.rowSpan },
      }),
    },
    {
      title: '操作',
      key: 'actions',
      width: 144,
      fixed: 'right',
      render: (_, row) => ({
        children: (
          <Space className="voucher-row-actions" direction="vertical" size={0}>
            <button
              type="button"
              onClick={() => {
                navigate(`/vouchers/${row.voucher.id}`)
              }}
            >
              查看
            </button>
            <button
              disabled={!isVoucherEditable(row.voucher.status)}
              type="button"
              onClick={() => {
                navigate(`/vouchers/${row.voucher.id}/edit`)
              }}
            >
              编辑
            </button>
            {row.voucher.status === 'draft' ? (
              <button
                type="button"
                onClick={() => {
                  void handleAudit(row.voucher.id)
                }}
              >
                审核
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void handleReverseAudit(row.voucher.id)
                }}
              >
                反审核
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void handleRedReversal(row.voucher.id)
              }}
            >
              红冲
            </button>
          </Space>
        ),
        props: { rowSpan: row.rowSpan },
      }),
    },
  ]

  return (
    <div className="voucher-management">
      <div className="voucher-tabs">
        <button className="voucher-tabs__item" type="button">
          首页
        </button>
        <button className="voucher-tabs__item voucher-tabs__item--active" type="button">
          会计凭证
        </button>
      </div>

      <div className="voucher-breadcrumb">
        <span>财务</span>
        <span>»</span>
        <strong>会计凭证</strong>
      </div>

      <div className="voucher-toolbar">
        <div className="voucher-toolbar__actions">
          <Button
            icon={<FileAddOutlined />}
            onClick={() => {
              navigate('/vouchers/new')
            }}
            type="primary"
          >
            增加
          </Button>
          <Button
            disabled={!selectedVoucher || selectedVoucher.status !== 'draft'}
            icon={<CheckCircleOutlined />}
            onClick={() => {
              void handleAudit()
            }}
          >
            审核
          </Button>
          <Button
            disabled={!selectedVoucher || selectedVoucher.status !== 'approved'}
            icon={<RollbackOutlined />}
            onClick={() => {
              void handleReverseAudit()
            }}
          >
            反审核
          </Button>
          <Button icon={<PrinterOutlined />}>打印</Button>
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
          <Button icon={<CopyOutlined />}>复制凭证</Button>
          <Button
            danger
            disabled={!selectedVoucher || selectedVoucher.status !== 'approved'}
            icon={<StopOutlined />}
            onClick={() => {
              void handleRedReversal()
            }}
          >
            红冲凭证
          </Button>
          <Popconfirm
            cancelText="取消"
            okText="确认"
            title="当前版本仅演示删除入口，暂不执行删除。"
          >
            <Button danger icon={<DeleteOutlined />}>
              批量删除
            </Button>
          </Popconfirm>
          <Button>更多功能</Button>
        </div>
        <div className="voucher-toolbar__meta">
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshList}
          >
            刷新
          </Button>
          <Button
            icon={<SearchOutlined />}
            onClick={() => {
              setShowFilters((value) => !value)
            }}
          >
            显示查询条件
          </Button>
          <Select
            options={[
              { label: '50 条', value: 50 },
              { label: '20 条', value: 20 },
              { label: '10 条', value: 10 },
            ]}
            size="small"
            value={pageSize}
            onChange={(value) => {
              setPage(1)
              setPageSize(value)
            }}
          />
        </div>
      </div>

      {showFilters ? (
        <Form
          className="voucher-filter-strip"
          form={form}
          initialValues={{ status: 'all' }}
          layout="inline"
          onFinish={(values) => {
            setPage(1)
            setFilters({
              keyword: values.keyword,
              status: values.status ?? 'all',
              voucherDate: values.voucherDate ?? null,
            })
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
      ) : null}

      {errorMessage ? <Alert className="voucher-error" message={errorMessage} showIcon type="error" /> : null}

      <div className="voucher-entry-filters" aria-label="分录筛选">
        <span className="voucher-entry-filters__label">分录筛选</span>
        {entryFilterOptions.map((option) => (
          <Checkbox
            checked={activeEntryFilterKeys.includes(option.key)}
            key={option.key}
            onChange={(event) => {
              setActiveEntryFilterKeys((current) => {
                if (event.target.checked) {
                  return current.includes(option.key) ? current : [...current, option.key]
                }

                return current.filter((key) => key !== option.key)
              })
            }}
          >
            {option.label}
          </Checkbox>
        ))}
      </div>

      <Table<VoucherGridRow>
        className="voucher-ledger-table"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: false,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (nextPage) => {
            setPage(nextPage)
          },
        }}
        rowClassName={(row) =>
          [
            row.voucher.id === selectedVoucherId ? 'voucher-row--selected' : '',
            row.voucher.id === hoveredVoucherId ? 'voucher-row--hovered' : '',
          ]
            .filter(Boolean)
            .join(' ')
        }
        scroll={{ x: 1510 }}
        size="small"
        sticky
        onRow={(row) => ({
          onClick: () => {
            setSelectedVoucherId(row.voucher.id)
          },
          onMouseEnter: () => {
            setHoveredVoucherId(row.voucher.id)
          },
          onMouseLeave: () => {
            setHoveredVoucherId(null)
          },
        })}
      />

      <div className="voucher-statusbar">
        <span>
          当前期间：{selectedPeriod ? `${selectedPeriod.year}-${String(selectedPeriod.month).padStart(2, '0')}` : '未选择'}
        </span>
        <span>账套：{selectedCompany?.name ?? '未选择'}</span>
        <Tooltip title="当前页面使用 mock 数据，后续可接入 Tauri 服务。">
          <span>数据来源：浏览器预览</span>
        </Tooltip>
      </div>
    </div>
  )
}
