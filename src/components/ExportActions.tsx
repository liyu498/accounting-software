import { DownOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import { useState } from 'react'

interface ExportActionsProps {
  title: string
  onExport: (format: 'excel' | 'pdf') => Promise<void>
}

export function ExportActions({ onExport }: ExportActionsProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport(format: 'excel' | 'pdf') {
    setLoading(true)
    try {
      await onExport(format)
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
