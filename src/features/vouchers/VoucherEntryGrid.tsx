import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, InputNumber, Popconfirm, Select, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { VoucherEntry } from '../../services/types'

type VoucherEntryGridProps = {
  entries: VoucherEntry[]
  onChange: (entries: VoucherEntry[]) => void
  disabled?: boolean
}

type VoucherAccountOption = {
  value: string
  label: string
  accountName: string
}

export const voucherAccountOptions: VoucherAccountOption[] = [
  { value: '1001', label: '1001 库存现金', accountName: '库存现金' },
  { value: '1002', label: '1002 银行存款', accountName: '银行存款' },
  { value: '2202', label: '2202 应付账款', accountName: '应付账款' },
  { value: '6001', label: '6001 主营业务收入', accountName: '主营业务收入' },
]

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

export function VoucherEntryGrid({ entries, onChange, disabled = false }: VoucherEntryGridProps) {
  function updateEntry(entryId: string, patch: Partial<VoucherEntry>) {
    onChange(
      entries.map((entry) => {
        if (entry.id !== entryId) {
          return entry
        }

        return { ...entry, ...patch }
      }),
    )
  }

  function handleRemove(entryId: string) {
    onChange(entries.filter((entry) => entry.id !== entryId))
  }

  function handleAdd() {
    onChange([...entries, createEmptyEntry()])
  }

  const columns: ColumnsType<VoucherEntry> = [
    {
      title: '摘要',
      dataIndex: 'summary',
      key: 'summary',
      render: (_, record) => (
        <Input
          disabled={disabled}
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
      width: 240,
      render: (_, record) => (
        <Select
          disabled={disabled}
          options={voucherAccountOptions}
          optionFilterProp="label"
          placeholder="选择科目"
          showSearch
          style={{ width: '100%' }}
          value={record.accountCode || undefined}
          filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          onChange={(value) => {
            const option = voucherAccountOptions.find((item) => item.value === value)
            updateEntry(record.id, {
              accountCode: value,
              accountName: option?.accountName ?? '',
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
          disabled={disabled}
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
          disabled={disabled}
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
      width: 110,
      render: (_, record) => (
        <Popconfirm
          cancelText="取消"
          disabled={disabled || entries.length <= 2}
          okText="删除"
          placement="left"
          title="确认删除这条分录吗？"
          description="删除后无法恢复，请确认当前分录不再需要。"
          onConfirm={() => {
            handleRemove(record.id)
          }}
        >
          <Button danger disabled={disabled || entries.length <= 2} icon={<DeleteOutlined />} type="text" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
      <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
        <Button disabled={disabled} icon={<PlusOutlined />} onClick={handleAdd}>
          添加分录
        </Button>
      </Space>
      <Table<VoucherEntry> columns={columns} dataSource={entries} pagination={false} rowKey="id" />
    </Space>
  )
}
