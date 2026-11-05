export function confirmTaxDeclarationReview(
  task,
  requestConfirmation = (message) => globalThis.confirm(message),
) {
  return requestConfirmation(
    `确认已复核“${task.formName}”的取数、校验和应缴金额，并完成本地确认吗？此操作不会向电子税务局提交申报。`,
  )
}
