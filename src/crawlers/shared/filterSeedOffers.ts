import type { Offer } from '../../lib/schema';

export function filterStaleSeedOffers(seedOffers: Offer[], refreshedSourceUrls: string[], refreshedIssuers: string[] = []): Offer[] {
  const refreshed = refreshedSourceUrls.map((url) => normalizeUrl(url));
  const issuerSet = new Set(refreshedIssuers.map((issuer) => issuer.toLowerCase()));
  return seedOffers.filter(
    (offer) => !refreshed.some((sourceUrl) => normalizeUrl(offer.sourceUrl).startsWith(sourceUrl)) && !issuerSet.has(offer.issuer.toLowerCase()),
  );
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
