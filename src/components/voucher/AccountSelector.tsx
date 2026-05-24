import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useAccountStore, AccountCode } from '../../stores/accountStore'
import { useCompanyStore } from '../../stores/companyStore'
import { cn } from '../../lib/utils'
import { ChevronDown, Search } from 'lucide-react'

interface AccountSelectorProps {
  value: { code: string; name: string }
  onChange: (value: { code: string; name: string }) => void
  className?: string
}

export function AccountSelector({ value, onChange, className }: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<AccountCode[]>([])
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLDivElement>(null)
  const { accounts, searchAccounts, fetchAccounts } = useAccountStore()
  const { selectedCompanyId } = useCompanyStore()

  useEffect(() => {
    if (selectedCompanyId) fetchAccounts(selectedCompanyId)
  }, [selectedCompanyId, fetchAccounts])

  const enabledAccounts = accounts.filter(a => a.is_enabled && a.is_detail)
  const parentAccounts = accounts.filter(a => a.is_enabled && a.level === 1)

  useEffect(() => {
    if (searchKeyword && selectedCompanyId) {
      searchAccounts(searchKeyword, selectedCompanyId).then(setSearchResults)
    } else {
      setSearchResults([])
    }
  }, [searchKeyword, searchAccounts, selectedCompanyId])

  // Calculate fixed dropdown position based on trigger element
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 360),
      zIndex: 9999,
    })
  }, [])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      // Also check portal dropdown
      const dropdownEl = document.getElementById('account-selector-dropdown')
      if (dropdownEl?.contains(target)) return
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (account: AccountCode) => {
    onChange({ code: account.code, name: account.name })
    setIsOpen(false)
    setSearchKeyword('')
  }

  const displayAccounts = searchKeyword ? searchResults : enabledAccounts

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      {/* Selector Input */}
      <div
        className="flex items-center border border-gray-300 rounded px-2 py-1.5 cursor-pointer hover:border-gray-400 bg-white h-9"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex items-center gap-1 min-w-0">
          {value.code ? (
            <>
              <span className="text-xs text-gray-500 font-mono flex-shrink-0">{value.code}</span>
              <span className="text-gray-900 text-sm truncate">{value.name}</span>
            </>
          ) : (
            <span className="text-gray-400 text-sm">选择科目...</span>
          )}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </div>

      {/* Dropdown — rendered via portal to escape table clipping */}
      {isOpen && createPortal(
        <div
          id="account-selector-dropdown"
          style={dropdownStyle}
          className="bg-white border border-gray-200 rounded-lg shadow-xl"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="输入科目编码或名称搜索..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
          </div>

          {/* Account List */}
          <div className="max-h-72 overflow-y-auto">
            {displayAccounts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                未找到匹配的科目
              </div>
            ) : searchKeyword ? (
              displayAccounts.map((account) => (
                <div
                  key={account.code}
                  className={cn(
                    'flex items-center px-4 py-2 cursor-pointer hover:bg-gray-50',
                    value.code === account.code && 'bg-blue-50',
                  )}
                  onClick={() => handleSelect(account)}
                >
                  <span className="text-xs text-gray-500 font-mono w-20">{account.code}</span>
                  <span className="text-gray-900 flex-1">{account.name}</span>
                </div>
              ))
            ) : (
              parentAccounts.map((parent) => {
                const subAccounts = accounts.filter(
                  a => a.parent_code === parent.code && a.is_enabled && a.is_detail,
                )
                if (subAccounts.length === 0 && !parent.is_detail) return null
                return (
                  <div key={parent.code}>
                    {parent.is_detail ? (
                      <div
                        className={cn(
                          'flex items-center px-4 py-2 cursor-pointer hover:bg-gray-50',
                          value.code === parent.code && 'bg-blue-50',
                        )}
                        onClick={() => handleSelect(parent)}
                      >
                        <span className="text-xs text-gray-500 font-mono w-20">{parent.code}</span>
                        <span className="text-gray-900 flex-1">{parent.name}</span>
                      </div>
                    ) : (
                      <div className="px-4 py-1 text-xs font-medium text-gray-400 bg-gray-50">
                        {parent.code} {parent.name}
                      </div>
                    )}
                    {subAccounts.map((sub) => (
                      <div
                        key={sub.code}
                        className={cn(
                          'flex items-center px-4 py-2 pl-8 cursor-pointer hover:bg-gray-50',
                          value.code === sub.code && 'bg-blue-50',
                        )}
                        onClick={() => handleSelect(sub)}
                      >
                        <span className="text-xs text-gray-500 font-mono w-20">{sub.code}</span>
                        <span className="text-gray-700 flex-1">{sub.name}</span>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
