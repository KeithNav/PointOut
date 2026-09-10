export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `po-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}
