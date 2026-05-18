import type { Offer } from '../../lib/schema';

export function dedupeOffers(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  const result: Offer[] = [];

  for (const offer of offers) {
    const id = stableOfferId(offer);
    const key = `${offer.sourceUrl}|${offer.title}|${offer.endDate ?? ''}|${offer.issuer}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...offer, id });
  }

  return result;
}

export function stableOfferId(offer: Pick<Offer, 'region' | 'issuer' | 'title' | 'endDate'>): string {
  return [offer.region, offer.issuer, offer.title, offer.endDate]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}
