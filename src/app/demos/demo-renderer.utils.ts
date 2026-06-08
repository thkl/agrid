/** Escape dynamic text before inserting it into a cellRenderer HTML string. */
export function escapeRendererText(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Convert a known display value into a stable CSS class suffix. */
export function rendererClassSuffix(value: unknown): string {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
