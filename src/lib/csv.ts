export function escapeCsvCell(value: unknown) {
  if (value == null) return ''
  let text = String(value)
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`
  if (text.includes(',') || text.includes('"') || /[\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}
