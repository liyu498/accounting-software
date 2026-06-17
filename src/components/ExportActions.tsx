import { DownOutlined } from '@ant-design/icons'
import { Button, Dropdown, message } from 'antd'
import { useState } from 'react'
import { accountingApi } from '../services/accountingApi'
import type { ExportInput } from '../services/types'

type ExportActionsProps = {
  type: ExportInput['type']
  title: string
}

export function ExportActions({ type, title }: ExportActionsProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport(format: ExportInput['format']) {
    setLoading(true)
    try {
      const result = await accountingApi.exportDocument({ format, title, type })
      message.success(result.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '瀵煎嚭澶辫触')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'excel',
            label: '瀵煎嚭 Excel',
            onClick: () => {
              void handleExport('excel')
            },
          },
          {
            key: 'pdf',
            label: '瀵煎嚭 PDF',
            onClick: () => {
              void handleExport('pdf')
            },
          },
        ],
      }}
      trigger={['click']}
    >
      <Button icon={<DownOutlined />} loading={loading}>
        瀵煎嚭
      </Button>
    </Dropdown>
  )
}
