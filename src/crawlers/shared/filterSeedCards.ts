import type { CreditCard } from '../../lib/schema';

export function filterStaleSeedCards(seedCards: CreditCard[], refreshedSourceUrls: string[]): CreditCard[] {
  const refreshed = refreshedSourceUrls.map(toComparableUrl).filter((url): url is ComparableUrl => Boolean(url));
  return seedCards.filter((card) => !card.sourceUrls.some((sourceUrl) => matchesRefreshedSource(sourceUrl, refreshed)));
}

interface ComparableUrl {
  text: string;
  isRoot: boolean;
}

function matchesRefreshedSource(sourceUrl: string, refreshed: ComparableUrl[]): boolean {
  const source = toComparableUrl(sourceUrl);
  if (!source) return false;
  return refreshed.some((refreshedUrl) => {
    if (source.text.startsWith(refreshedUrl.text) && !refreshedUrl.isRoot) return true;
    return refreshedUrl.text.startsWith(source.text) && source.isRoot;
  });
}

function toComparableUrl(url: string): ComparableUrl | undefined {
  try {
    const parsed = new URL(url);
    const normalizedPath = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
    return {
      text: `${parsed.origin}${normalizedPath}`,
      isRoot: normalizedPath === '/',
    };
  } catch {
    return undefined;
  }
}
