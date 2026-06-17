import { DownOutlined } from '@ant-design/icons'
import { Button, Dropdown, message } from 'antd'
import { useState } from 'react'
import type { ExportResult } from '../services/types'

interface ExportActionsProps {
  title: string
  onExport: (format: 'excel' | 'pdf') => Promise<ExportResult>
}

export function ExportActions({ title, onExport }: ExportActionsProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport(format: 'excel' | 'pdf') {
    setLoading(true)
    try {
      const result = await onExport(format)
      message.success(result.message)
    } catch (error) {
      message.error(error instanceof Error ? error.message : `${title}导出失败`)
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
            label: 'Excel',
            onClick: () => {
              void handleExport('excel')
            },
          },
          {
            key: 'pdf',
            label: 'PDF',
            onClick: () => {
              void handleExport('pdf')
            },
          },
        ],
      }}
      trigger={['click']}
    >
      <Button icon={<span aria-hidden="true"><DownOutlined /></span>} loading={loading}>
        导出
      </Button>
    </Dropdown>
  )
}
