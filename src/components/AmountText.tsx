type AmountTextProps = {
  value: number
  className?: string
}

const formatter = new Intl.NumberFormat('zh-CN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function AmountText({ value, className }: AmountTextProps) {
  const mergedClassName = className ? `amount-text ${className}` : 'amount-text'
  return <span className={mergedClassName}>{formatter.format(value)}</span>
}
