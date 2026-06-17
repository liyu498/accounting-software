import { App as AntApp, ConfigProvider, theme } from 'antd'
import type { ReactNode } from 'react'
import zhCN from 'antd/locale/zh_CN'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.compactAlgorithm,
        token: {
          colorPrimary: '#1f5fbf',
          borderRadius: 6,
          fontSize: 13,
        },
      }}
    >
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  )
}
