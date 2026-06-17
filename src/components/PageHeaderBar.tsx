import { Space, Typography } from 'antd'
import type { ReactNode } from 'react'

type PageHeaderBarProps = {
  title: string
  subtitle?: string
  extra?: ReactNode
}

export function PageHeaderBar({ title, subtitle, extra }: PageHeaderBarProps) {
  return (
    <div className="page-header-bar">
      <div>
        <Typography.Title className="page-header-bar__title" level={2}>
          {title}
        </Typography.Title>
        {subtitle ? (
          <Typography.Paragraph className="page-header-bar__subtitle" type="secondary">
            {subtitle}
          </Typography.Paragraph>
        ) : null}
      </div>
      {extra ? <Space size={12}>{extra}</Space> : null}
    </div>
  )
}
