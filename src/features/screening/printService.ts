/**
 * Print via hidden iframe — รองรับฟอนต์ไทย + page size ที่ต่างกัน + ไม่ปนกับ DOM หลัก
 * ผู้ใช้กดบันทึกเป็น PDF จาก print dialog
 */
export function printHtml(html: string, pageCss: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) {
      document.body.removeChild(iframe)
      resolve()
      return
    }

    const fontLink = '<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">'

    doc.open()
    doc.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  ${fontLink}
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Prompt', 'Sarabun', sans-serif; margin: 0; padding: 0; color: #000; }
    ${pageCss}
  </style>
</head>
<body>${html}</body>
</html>`)
    doc.close()

    // wait fonts + layout
    const w = iframe.contentWindow!
    const finish = () => {
      try {
        w.focus()
        w.print()
      } catch {/* ignore */}
      setTimeout(() => {
        try { document.body.removeChild(iframe) } catch {/* ignore */}
        resolve()
      }, 800)
    }

    // ใช้ document.fonts.ready ถ้ามี
    const docFonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    if (docFonts?.ready) {
      docFonts.ready.then(() => setTimeout(finish, 300))
    } else {
      setTimeout(finish, 800)
    }
  })
}

export function escapeHtml(s: unknown): string {
  if (s === undefined || s === null || s === '') return ''
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
