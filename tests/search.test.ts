import { describe, expect, it } from 'vitest';
import { filterOffers, sortOffers } from '../src/lib/search';
import type { Offer } from '../src/lib/schema';

const offers: Offer[] = [
  {
    id: 'a',
    region: 'CN',
    issuer: '民生银行',
    title: '餐饮满减',
    merchant: '海底捞',
    category: 'dining',
    endDate: '2026-05-20',
    discountType: 'instant-discount',
    valueText: '满 200 减 50',
    estimatedValue: 50,
    currency: 'CNY',
    minSpend: 200,
    requiresRegistration: false,
    sourceUrl: 'https://creditcard.cmbc.com.cn/',
    sourceReliability: 'official',
    lastCheckedAt: '2026-05-17T00:00:00.000Z',
    score: 82,
  },
  {
    id: 'b',
    region: 'US',
    issuer: 'Chase',
    title: 'Travel statement credit',
    merchant: 'Chase Travel',
    category: 'travel',
    endDate: '2026-08-31',
    discountType: 'statement-credit',
    valueText: '$50 credit',
    estimatedValue: 50,
    currency: 'USD',
    minSpend: 50,
    requiresRegistration: true,
    sourceUrl: 'https://creditcards.chase.com/',
    sourceReliability: 'official',
    lastCheckedAt: '2026-05-16T00:00:00.000Z',
    score: 75,
  },
];

describe('filterOffers', () => {
  it('filters by region, issuer, category, registration, minimum score, and keyword', () => {
    const result = filterOffers(offers, {
      region: 'CN',
      issuer: '民生银行',
      category: 'dining',
      requiresRegistration: false,
      minScore: 80,
      query: '海底捞',
    });

    expect(result.map((offer) => offer.id)).toEqual(['a']);
  });
});

describe('sortOffers', () => {
  it('sorts expiring offers before later offers', () => {
    const result = sortOffers(offers, 'expiring');

    expect(result.map((offer) => offer.id)).toEqual(['a', 'b']);
  });

  it('sorts by highest estimated value', () => {
    const result = sortOffers([
      { ...offers[0]!, estimatedValue: 30 },
      { ...offers[1]!, estimatedValue: 80 },
    ], 'value');

    expect(result.map((offer) => offer.id)).toEqual(['b', 'a']);
  });
});
