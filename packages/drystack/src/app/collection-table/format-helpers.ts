export function formatDateValue(value: string): string {
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
}

export function formatDatetimeValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatNumberValue(value: number): string {
  return new Intl.NumberFormat(undefined).format(value);
}

// fields.content() stores its value as an HTML string (see
// parseToEditorStateHTML in form/fields/content/index.tsx) — strip tags so
// the table can show plain-text word/character counts and a readable preview
// instead of raw markup, without pulling in a full HTML parser
export function stripHtmlForPreview(raw: string): string {
  return raw
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function summarizeContent(raw: string): string {
  const plainText = stripHtmlForPreview(raw);
  if (!plainText) return 'Empty';
  const words = plainText.split(/\s+/).length;
  const chars = plainText.length;
  const charLabel =
    chars >= 1000 ? `${(chars / 1000).toFixed(1)}k characters` : `${chars} characters`;
  return `${charLabel} - ${words} word${words === 1 ? '' : 's'}`;
}
