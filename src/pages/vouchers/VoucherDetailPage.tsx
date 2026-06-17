import { CheckCircleOutlined, EditOutlined, RollbackOutlined, StopOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Popconfirm, Space, Table, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AmountText } from '../../components/AmountText'
import { ExportActions } from '../../components/ExportActions'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { accountingApi } from '../../services/accountingApi'
import type { VoucherDetail, VoucherEntry, VoucherStatus } from '../../services/types'

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

const columns: ColumnsType<VoucherEntry> = [
  { title: '摘要', dataIndex: 'summary', key: 'summary' },
  { title: '科目编码', dataIndex: 'accountCode', key: 'accountCode', width: 120 },
  { title: '科目名称', dataIndex: 'accountName', key: 'accountName', width: 180 },
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
]

export function VoucherDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null)

  async function loadVoucher() {
    if (!id) {
      setErrorMessage('缺少凭证编号')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const detail = await accountingApi.getVoucher(id)
      setVoucher(detail)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '凭证详情加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVoucher()
  }, [id])

  async function handleAudit() {
    if (!voucher) {
      return
    }

    try {
      await accountingApi.auditVoucher(voucher.id)
      message.success('凭证已审核')
      await loadVoucher()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '审核失败')
    }
  }

  async function handleReverseAudit() {
    if (!voucher) {
      return
    }

    try {
      await accountingApi.reverseAuditVoucher(voucher.id)
      message.success('已反审核凭证')
      await loadVoucher()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '反审核失败')
    }
  }

  async function handleRedReversal() {
    if (!voucher) {
      return
    }

    try {
      const reversal = await accountingApi.createRedReversal(voucher.id)
      message.success(`已生成红字冲销凭证 ${reversal.voucherNumber}`)
      await loadVoucher()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '红字冲销失败')
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title={voucher ? `凭证 ${voucher.voucherNumber}` : '凭证详情'}
        subtitle={voucher ? `${voucher.voucherDate} · ${voucher.summary || '未填写摘要'}` : '查看凭证分录与状态'}
        extra={
          <Space wrap>
            <ExportActions title={voucher?.voucherNumber ?? '凭证详情'} type="voucher" />
            <Button
              onClick={() => {
                navigate('/vouchers')
              }}
            >
              返回列表
            </Button>
            <Button
              disabled={!voucher || voucher.status !== 'draft'}
              icon={<EditOutlined />}
              onClick={() => {
                if (voucher) {
                  navigate(`/vouchers/${voucher.id}/edit`)
                }
              }}
            >
              编辑
            </Button>
            {voucher?.status === 'draft' ? (
              <Popconfirm
                cancelText="取消"
                okText="确认"
                onConfirm={() => {
                  void handleAudit()
                }}
                title="确认审核这张凭证吗？"
              >
                <Button icon={<CheckCircleOutlined />} type="primary">
                  审核
                </Button>
              </Popconfirm>
            ) : null}
            {voucher?.status === 'approved' ? (
              <>
                <Popconfirm
                  cancelText="取消"
                  okText="确认"
                  onConfirm={() => {
                    void handleReverseAudit()
                  }}
                  title="确认反审核这张凭证吗？"
                >
                  <Button icon={<RollbackOutlined />}>反审核</Button>
                </Popconfirm>
                <Popconfirm
                  cancelText="取消"
                  okText="确认"
                  onConfirm={() => {
                    void handleRedReversal()
                  }}
                  title="确认生成红字冲销凭证吗？"
                >
                  <Button danger icon={<StopOutlined />}>
                    红字冲销
                  </Button>
                </Popconfirm>
              </>
            ) : null}
          </Space>
        }
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      <Card loading={loading}>
        {voucher ? (
          <Descriptions
            column={2}
            items={[
              { key: 'voucherDate', label: '凭证日期', children: voucher.voucherDate },
              { key: 'voucherWord', label: '凭证字', children: voucher.voucherWord },
              { key: 'voucherNumber', label: '凭证号', children: voucher.voucherNumber },
              {
                key: 'status',
                label: '状态',
                children: <Tag color={statusColor(voucher.status)}>{statusLabels[voucher.status]}</Tag>,
              },
              { key: 'summary', label: '摘要', children: voucher.summary || '未填写摘要' },
              { key: 'attachmentCount', label: '附件张数', children: voucher.attachmentCount },
              { key: 'createdBy', label: '制单人', children: voucher.createdBy },
              { key: 'debitTotal', label: '借方合计', children: <AmountText value={voucher.debitTotal} /> },
              { key: 'creditTotal', label: '贷方合计', children: <AmountText value={voucher.creditTotal} /> },
            ]}
          />
        ) : null}
      </Card>

      <Card title="分录明细">
        <Table<VoucherEntry> columns={columns} dataSource={voucher?.entries ?? []} pagination={false} rowKey="id" />
      </Card>
    </Space>
  )
}
