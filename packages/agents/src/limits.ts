/** Limites alineados con @sf/contracts: transitionEventSchema.reason (500) y evidenceEntrySchema.detail (10000). */
const MAX_REASON = 500;
const MAX_DETAIL = 10000;

export function stepReason(prefix: string, summary: string): string {
  return bound(MAX_REASON, `${prefix}: ${summary}`);
}

export function boundDetail(text: string): string {
  return bound(MAX_DETAIL, text);
}

function bound(limit: number, text: string): string {
  return text.length <= limit ? text : text.slice(0, limit);
}
