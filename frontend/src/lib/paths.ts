/** Encode IDs like `/hostedzone/ABC` for API path segments (avoids double-slash URL bugs). */
export function toApiPathId(id: string): string {
  return id.replace(/^\//, "");
}

/** Encode IDs for Next.js page URLs (single path segment). */
export function toPagePathId(id: string): string {
  return encodeURIComponent(id);
}

export function fromPagePathId(id: string): string {
  return decodeURIComponent(id);
}

/** Restore API path id to database id format. */
export function fromApiPathId(id: string): string {
  return id.startsWith("/") ? id : `/${id}`;
}
