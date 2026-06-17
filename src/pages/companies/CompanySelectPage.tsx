import { Alert, Button, Card, List, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompanyStore } from '../../stores/companyStore'

export function CompanySelectPage() {
  const navigate = useNavigate()
  const { companies, selectedCompany, loadCompanies, selectCompany } = useCompanyStore((state) => ({
    companies: state.companies,
    selectedCompany: state.selectedCompany,
    loadCompanies: state.loadCompanies,
    selectCompany: state.selectCompany,
  }))
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setErrorMessage(null)
      try {
        await loadCompanies()
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '账套加载失败')
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
  }, [loadCompanies])

  async function handleSelect(companyId: string) {
    setLoading(true)
    setErrorMessage(null)

    try {
      await selectCompany(companyId)
      navigate('/dashboard')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '账套选择失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="company-select-card" variant="borderless">
      <Typography.Title level={3}>选择账套</Typography.Title>
      <Typography.Paragraph type="secondary">登录后先选择账套和当前会计期间。</Typography.Paragraph>
      {errorMessage ? <Alert closable message={errorMessage} showIcon type="error" /> : null}
      <List
        bordered
        className="company-select-list"
        dataSource={companies}
        loading={loading}
        renderItem={(company) => (
          <List.Item
            actions={[
              <Button
                key={company.id}
                onClick={() => {
                  void handleSelect(company.id)
                }}
                type={selectedCompany?.id === company.id ? 'default' : 'primary'}
              >
                进入
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={company.name}
              description={`${company.code} · 税号 ${company.taxId}`}
            />
          </List.Item>
        )}
      />
    </Card>
  )
}
