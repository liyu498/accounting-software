import { SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Form, InputNumber, Result, Select, Space, Tag, Typography, message } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AmountText } from '../../components/AmountText'
import { PageHeaderBar } from '../../components/PageHeaderBar'
import { VoucherEntryGrid } from '../../features/vouchers/VoucherEntryGrid'
import { getVoucherTotals, isVoucherBalanced } from '../../features/vouchers/voucherRules'
import { accountingApi } from '../../services/accountingApi'
import type { SaveVoucherInput, VoucherDetail, VoucherEntry } from '../../services/types'
import { useCompanyStore } from '../../stores/companyStore'
import { getEditorModeState } from './voucherEditorState'
import { getVoucherSaveBlockMessage } from './voucherSaveGuard'

type VoucherFormValues = {
  voucherDate: Dayjs
  voucherWord: string
  attachmentCount: number
}

const voucherWordOptions = [{ label: '记', value: '记' }]

function buildInitialDate() {
  return dayjs().startOf('day')
}

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
      setErrorMessage(null)
      setLoading(false)
      setEntries([createEmptyEntry(), createEmptyEntry()])
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)
      setVoucher(null)

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
          setEntries([createEmptyEntry(), createEmptyEntry()])
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
  const editorModeState = getEditorModeState({
    routeVoucherId: id,
    loading,
    voucher,
    loadErrorMessage: errorMessage,
  })

  async function handleSave(values: VoucherFormValues) {
    if (!editorModeState.canSave) {
      return
    }

    const blockMessage = getVoucherSaveBlockMessage({
      canSave: editorModeState.canSave,
      hasCompany: Boolean(selectedCompany),
      hasPeriod: Boolean(selectedPeriodId),
      entries,
    })

    if (blockMessage) {
      setErrorMessage(blockMessage)
      message.warning(blockMessage)
      return
    }

    const payload: SaveVoucherInput = {
      id: voucher?.id,
      companyId: selectedCompany!.id,
      periodId: selectedPeriodId!,
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
              disabled={!editorModeState.canSave || !balanced || saving}
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

      {errorMessage && editorModeState.mode !== 'load-error' ? <Alert message={errorMessage} showIcon type="error" /> : null}

      {editorModeState.mode === 'load-error' || editorModeState.mode === 'not-found' || editorModeState.mode === 'locked' ? (
        <Card>
          <Result
            extra={
              <Space>
                <Button
                  onClick={() => {
                    if (voucher) {
                      navigate(`/vouchers/${voucher.id}`)
                    } else {
                      navigate('/vouchers')
                    }
                  }}
                  type="primary"
                >
                  {voucher ? '返回凭证详情' : '返回凭证列表'}
                </Button>
                <Button
                  onClick={() => {
                    navigate('/vouchers')
                  }}
                >
                  返回列表
                </Button>
              </Space>
            }
            status={editorModeState.resultStatus}
            subTitle={editorModeState.subTitle}
            title={editorModeState.title}
          />
        </Card>
      ) : null}

      {editorModeState.mode === 'loading' ? <Card loading /> : null}

      {editorModeState.mode === 'create' || editorModeState.mode === 'edit' ? (
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
              <Form.Item label="附件张数" name="attachmentCount" rules={[{ required: true, message: '请输入附件张数' }]}>
                <InputNumber min={0} precision={0} style={{ width: 120 }} />
              </Form.Item>
            </Space>
          </Form>
        </Card>
      ) : null}

      {editorModeState.mode === 'create' || editorModeState.mode === 'edit' ? (
        <Card title="分录">
          <VoucherEntryGrid entries={entries} onChange={setEntries} />
        </Card>
      ) : null}

      {editorModeState.mode === 'create' || editorModeState.mode === 'edit' ? (
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
      ) : null}
    </Space>
  )
}
