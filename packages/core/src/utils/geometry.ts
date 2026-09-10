export function toPercent(px: number, total: number): number {
  return total > 0 ? (px / total) * 100 : 0;
}

export function toPixels(percent: number, total: number): number {
  return (percent / 100) * total;
}

/** Full scrollable document size, used so annotations can be placed anywhere on the page, not just the visible viewport. */
export function docSize(): { width: number; height: number } {
  const el = document.documentElement;
  return {
    width: Math.max(el.scrollWidth, window.innerWidth),
    height: Math.max(el.scrollHeight, window.innerHeight),
  };
}

export function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}
