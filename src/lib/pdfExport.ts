import DOMPurify from 'dompurify'

interface ExportHtmlToPdfOptions {
  html: string
  fileName: string
  pageTitle: string
}

const chineseFontStack = '"Noto Sans SC","PingFang SC","Microsoft YaHei","Source Han Sans SC",Arial,sans-serif'

async function waitForChineseFonts() {
  if (!('fonts' in document)) return
  await Promise.all([
    document.fonts.load('400 12px "Noto Sans SC"'),
    document.fonts.load('500 12px "Noto Sans SC"'),
    document.fonts.load('700 18px "Noto Sans SC"'),
  ])
  await document.fonts.ready
}

function sanitizePrintableStyles(styles: string) {
  return styles
    .replace(/@(?:import|namespace)\s+[^;]+;?/gi, '')
    .replace(/(?:-moz-)?binding\s*:[^;]+;?/gi, '')
    .replace(/behavior\s*:[^;]+;?/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(/url\s*\([^)]*\)/gi, 'none')
}

export function sanitizePrintableHtml(html: string) {
  const sanitized = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['base', 'embed', 'form', 'iframe', 'link', 'meta', 'object', 'script'],
    FORBID_ATTR: ['formaction', 'srcset'],
  })
  const documentHtml = new DOMParser().parseFromString(sanitized, 'text/html')
  for (const style of documentHtml.querySelectorAll('style')) {
    style.textContent = sanitizePrintableStyles(style.textContent || '')
  }
  return `<!doctype html>${documentHtml.documentElement.outerHTML}`
}

function extractPrintableHtml(sanitizedHtml: string) {
  const documentHtml = new DOMParser().parseFromString(sanitizedHtml, 'text/html')
  const styles = sanitizePrintableStyles(Array.from(documentHtml.querySelectorAll('style')).map((style) => style.textContent || '').join('\n'))
  return { styles, bodyNodes: Array.from(documentHtml.body.childNodes) }
}

function isLandscapeDocument(html: string) {
  return /@page\s*\{[^}]*\blandscape\b/i.test(html)
}

function collectPdfPageBreaks(root: HTMLElement, canvas: HTMLCanvasElement, sliceHeightPx: number) {
  const rootRect = root.getBoundingClientRect()
  const cssHeight = Math.max(root.scrollHeight, Math.ceil(rootRect.height), 1)
  const canvasScale = canvas.height / cssHeight
  const rowStarts = Array.from(root.querySelectorAll('tr, .voucher, .page-break-block'))
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return Math.round((rect.top - rootRect.top) * canvasScale)
    })
    .filter((offset) => offset > 0 && offset < canvas.height)
    .sort((left, right) => left - right)

  const breaks: Array<{ top: number; height: number }> = []
  let top = 0
  while (top < canvas.height) {
    const desiredEnd = Math.min(top + sliceHeightPx, canvas.height)
    const minimumEnd = top + Math.floor(sliceHeightPx * 0.55)
    const safeCandidates = rowStarts.filter((offset) => offset >= minimumEnd && offset <= desiredEnd)
    const safeEnd = safeCandidates[safeCandidates.length - 1]
    const end = safeEnd ?? desiredEnd
    breaks.push({ top, height: end - top })
    top = end
  }
  return breaks
}

export async function exportHtmlToPdf({ html, fileName, pageTitle }: ExportHtmlToPdfOptions) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const sanitizedHtml = sanitizePrintableHtml(html)
  const { styles, bodyNodes } = extractPrintableHtml(sanitizedHtml)
  const isLandscape = isLandscapeDocument(sanitizedHtml)
  const renderWidth = isLandscape ? 1500 : 1120
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = `${renderWidth}px`
  host.style.background = '#ffffff'
  host.style.color = '#111827'
  const style = document.createElement('style')
  style.textContent = `
    * { box-sizing: border-box; }
    body, table, input, button { font-family: ${chineseFontStack}; letter-spacing: 0; }
    .pdf-render-root { width: ${renderWidth}px; min-height: 1px; background: #ffffff; padding: 0; font-family: ${chineseFontStack}; }
    ${styles}
  `
  const target = document.createElement('div')
  target.className = 'pdf-render-root'
  for (const node of bodyNodes) target.appendChild(document.importNode(node, true))
  host.append(style, target)
  document.body.appendChild(host)

  try {
    await waitForChineseFonts()
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      windowWidth: renderWidth,
      logging: false,
    })

    const pdf = new jsPDF({ orientation: isLandscape ? 'l' : 'p', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title: pageTitle, subject: pageTitle, creator: 'AI 代理记账' })

    const marginX = 8
    const marginY = 8
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidth = pageWidth - marginX * 2
    const contentHeight = pageHeight - marginY * 2
    const sliceHeightPx = Math.floor(canvas.width * (contentHeight / contentWidth))
    const pageBreaks = collectPdfPageBreaks(target, canvas, sliceHeightPx)

    pageBreaks.forEach(({ top, height }, pageIndex) => {
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = height
      const ctx = pageCanvas.getContext('2d')
      if (!ctx) throw new Error('PDF canvas context unavailable')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(canvas, 0, top, canvas.width, height, 0, 0, canvas.width, height)

      if (pageIndex > 0) pdf.addPage()
      const imageHeightMm = height * (contentWidth / canvas.width)
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', marginX, marginY, contentWidth, imageHeightMm)
      pdf.setFontSize(8)
      pdf.setTextColor(100)
      pdf.text(`${pageIndex + 1}`, pageWidth - marginX, pageHeight - 3, { align: 'right' })
    })

    pdf.save(fileName)
  } finally {
    host.remove()
  }
}
