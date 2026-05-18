export function resolvePublicUrl(href: string | undefined, sourceUrl: string): string {
  if (!href?.trim()) return sourceUrl;

  try {
    const resolved = new URL(href, sourceUrl);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : sourceUrl;
  } catch {
    return sourceUrl;
  }
}
