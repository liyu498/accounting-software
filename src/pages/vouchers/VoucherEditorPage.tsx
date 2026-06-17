import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AmountText } from '../../components/AmountText'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { getVoucherTotals, isVoucherBalanced } from '../../features/vouchers/voucherRules'
import { accountingApi } from '../../services/accountingApi'
import type { SaveVoucherInput, VoucherDetail, VoucherEntry } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'

type VoucherFormValues = {
  voucherDate: Dayjs
  voucherWord: string
  attachmentCount: number
}

type AccountOption = {
  value: string
  label: string
  name: string
}

const accountOptions: AccountOption[] = [
  { value: '1001', label: '1001 库存现金', name: '库存现金' },
  { value: '1002', label: '1002 银行存款', name: '银行存款' },
  { value: '2202', label: '2202 应付账款', name: '应付账款' },
  { value: '6001', label: '6001 主营业务收入', name: '主营业务收入' },
]

const voucherWordOptions = [{ label: '记', value: '记' }]

function createEmptyEntry(): VoucherEntry {
  return {
    id: `entry-${crypto.randomUUID()}`,
    summary: '',
    accountCode: '',
    accountName: '',
    debit: 0,
    credit: 0,
  }
}

function buildInitialDate() {
  return dayjs().startOf('day')
}

export function VoucherEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const selectedCompany = useCompanyStore((state) => state.selectedCompany)
  const selectedPeriodId = useCompanyStore((state) => state.selectedPeriodId)
  const [form] = Form.useForm<VoucherFormValues>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null)
  const [entries, setEntries] = useState<VoucherEntry[]>([createEmptyEntry(), createEmptyEntry()])

  useEffect(() => {
    if (!id) {
      form.setFieldsValue({
        voucherDate: buildInitialDate(),
        voucherWord: '记',
        attachmentCount: 1,
      })
      setVoucher(null)
      setEntries([createEmptyEntry(), createEmptyEntry()])
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        const detail = await accountingApi.getVoucher(id)
        if (cancelled) {
          return
        }

        setVoucher(detail)
        setEntries(detail.entries.map((entry) => ({ ...entry })))
        form.setFieldsValue({
          voucherDate: dayjs(detail.voucherDate),
          voucherWord: detail.voucherWord,
          attachmentCount: detail.attachmentCount,
        })
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '凭证加载失败')
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
  }, [form, id])

  const totals = useMemo(() => getVoucherTotals(entries), [entries])
  const balanced = useMemo(() => isVoucherBalanced(entries), [entries])

  function updateEntry(entryId: string, patch: Partial<VoucherEntry>) {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) {
          return entry
        }

        return { ...entry, ...patch }
      }),
    )
  }

  const columns: ColumnsType<VoucherEntry> = [
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      render: (_, record) => (
        <Input
          placeholder="请输入摘要"
          value={record.summary}
          onChange={(event) => {
            updateEntry(record.id, { summary: event.target.value })
          }}
        />
      ),
    },
    {
      title: '科目',
      dataIndex: 'accountCode',
      key: 'accountCode',
      width: 220,
      render: (_, record) => (
        <Select
          options={accountOptions}
          placeholder="选择科目"
          style={{ width: '100%' }}
          value={record.accountCode || undefined}
          onChange={(value) => {
            const option = accountOptions.find((item) => item.value === value)
            updateEntry(record.id, {
              accountCode: value,
              accountName: option?.name ?? '',
            })
          }}
        />
      ),
    },
    {
      title: '借方',
      dataIndex: 'debit',
      key: 'debit',
      width: 150,
      render: (_, record) => (
        <InputNumber
          controls={false}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={record.debit}
          onChange={(value) => {
            updateEntry(record.id, { debit: Number(value ?? 0) })
          }}
        />
      ),
    },
    {
      title: '贷方',
      dataIndex: 'credit',
      key: 'credit',
      width: 150,
      render: (_, record) => (
        <InputNumber
          controls={false}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          value={record.credit}
          onChange={(value) => {
            updateEntry(record.id, { credit: Number(value ?? 0) })
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 90,
      render: (_, record) => (
        <Button
          danger
          disabled={entries.length <= 2}
          icon={<DeleteOutlined />}
          onClick={() => {
            setEntries((current) => current.filter((entry) => entry.id !== record.id))
          }}
          type="text"
        />
      ),
    },
  ]

  async function handleSave(values: VoucherFormValues) {
    if (!selectedCompany || !selectedPeriodId) {
      setErrorMessage('请先选择账套和会计期间')
      return
    }

    const payload: SaveVoucherInput = {
      id: voucher?.id,
      companyId: selectedCompany.id,
      periodId: selectedPeriodId,
      voucherDate: values.voucherDate.format('YYYY-MM-DD'),
      voucherWord: values.voucherWord,
      attachmentCount: values.attachmentCount,
      entries,
    }

    setSaving(true)
    setErrorMessage(null)

    try {
      const saved = await accountingApi.saveVoucher(payload)
      message.success(voucher ? '凭证已保存' : '凭证已创建')
      navigate(`/vouchers/${saved.id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存凭证失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction="vertical" size={24} style={{ display: 'flex' }}>
      <PageHeaderBar
        title={voucher ? `编辑凭证 ${voucher.voucherNumber}` : '新建凭证'}
        subtitle="录入分录后，借贷平衡才可保存。"
        extra={
          <Space>
            <Button
              onClick={() => {
                navigate(voucher ? `/vouchers/${voucher.id}` : '/vouchers')
              }}
            >
              取消
            </Button>
            <Button
              disabled={!balanced || saving}
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={() => {
                void form.submit()
              }}
              type="primary"
            >
              保存
            </Button>
          </Space>
        }
      />

      {errorMessage ? <Alert message={errorMessage} showIcon type="error" /> : null}

      <Card loading={loading}>
        <Form<VoucherFormValues>
          form={form}
          initialValues={{
            voucherDate: buildInitialDate(),
            voucherWord: '记',
            attachmentCount: 1,
          }}
          layout="vertical"
          onFinish={(values) => {
            void handleSave(values)
          }}
        >
          <Space align="start" size={16} wrap>
            <Form.Item label="凭证日期" name="voucherDate" rules={[{ required: true, message: '请选择凭证日期' }]}>
              <DatePicker />
            </Form.Item>
            <Form.Item label="凭证字" name="voucherWord" rules={[{ required: true, message: '请选择凭证字' }]}>
              <Select options={voucherWordOptions} style={{ width: 120 }} />
            </Form.Item>
            <Form.Item
              label="附件张数"
              name="attachmentCount"
              rules={[{ required: true, message: '请输入附件张数' }]}
            >
              <InputNumber min={0} precision={0} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card
        extra={
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEntries((current) => [...current, createEmptyEntry()])
            }}
          >
            添加分录
          </Button>
        }
        title="分录"
      >
        <Table<VoucherEntry> columns={columns} dataSource={entries} pagination={false} rowKey="id" />
      </Card>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          padding: '12px 16px',
          background: '#fff',
          border: '1px solid #e5e6eb',
          borderRadius: 8,
        }}
      >
        <Space size={24} wrap>
          <Typography.Text>
            借方合计: <AmountText value={totals.debitTotal} />
          </Typography.Text>
          <Typography.Text>
            贷方合计: <AmountText value={totals.creditTotal} />
          </Typography.Text>
          <Tag color={balanced ? 'green' : 'red'}>{balanced ? '借贷平衡' : '借贷不平衡'}</Tag>
        </Space>
      </div>
    </Space>
  )
}
