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

function extractPrintableHtml(html: string) {
  const documentHtml = new DOMParser().parseFromString(html, 'text/html')
  const styles = Array.from(documentHtml.querySelectorAll('style')).map((style) => style.textContent || '').join('\n')
  const body = documentHtml.body.innerHTML
  return { styles, body }
}

export async function exportHtmlToPdf({ html, fileName, pageTitle }: ExportHtmlToPdfOptions) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const { styles, body } = extractPrintableHtml(html)
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.position = 'fixed'
  host.style.left = '-10000px'
  host.style.top = '0'
  host.style.width = '1120px'
  host.style.background = '#ffffff'
  host.style.color = '#111827'
  host.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      body, table, input, button { font-family: ${chineseFontStack}; letter-spacing: 0; }
      .pdf-render-root { width: 1120px; min-height: 1px; background: #ffffff; padding: 0; font-family: ${chineseFontStack}; }
      ${styles}
    </style>
    <div class="pdf-render-root">${body}</div>
  `
  document.body.appendChild(host)

  try {
    await waitForChineseFonts()
    const target = host.querySelector('.pdf-render-root') as HTMLElement
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      windowWidth: 1120,
      logging: false,
    })

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title: pageTitle, subject: pageTitle, creator: 'AI 代理记账' })

    const marginX = 8
    const marginY = 8
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const contentWidth = pageWidth - marginX * 2
    const contentHeight = pageHeight - marginY * 2
    const sliceHeightPx = Math.floor(canvas.width * (contentHeight / contentWidth))
    let renderedHeight = 0
    let pageIndex = 0

    while (renderedHeight < canvas.height) {
      const pageCanvas = document.createElement('canvas')
      const pageSliceHeight = Math.min(sliceHeightPx, canvas.height - renderedHeight)
      pageCanvas.width = canvas.width
      pageCanvas.height = pageSliceHeight
      const ctx = pageCanvas.getContext('2d')
      if (!ctx) throw new Error('PDF canvas context unavailable')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
      ctx.drawImage(canvas, 0, renderedHeight, canvas.width, pageSliceHeight, 0, 0, canvas.width, pageSliceHeight)

      if (pageIndex > 0) pdf.addPage()
      const imageHeightMm = pageSliceHeight * (contentWidth / canvas.width)
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', marginX, marginY, contentWidth, imageHeightMm)
      pdf.setFontSize(8)
      pdf.setTextColor(100)
      pdf.text(`${pageIndex + 1}`, pageWidth - marginX, pageHeight - 3, { align: 'right' })

      renderedHeight += pageSliceHeight
      pageIndex += 1
    }

    pdf.save(fileName)
  } finally {
    host.remove()
  }
}
