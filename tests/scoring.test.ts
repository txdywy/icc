import { describe, expect, it } from 'vitest';
import { scoreCard, scoreOffer } from '../src/lib/scoring';
import type { CreditCard, Offer } from '../src/lib/schema';

const baseCard: CreditCard = {
  id: 'us-chase-sapphire-preferred',
  region: 'US',
  issuer: 'Chase',
  name: 'Chase Sapphire Preferred',
  network: ['Visa'],
  annualFee: { amount: 95, currency: 'USD' },
  welcomeOffer: {
    headline: 'Earn 60,000 bonus points after spending $4,000 in 3 months',
    estimatedValue: 750,
    currency: 'USD',
    spendRequirement: 4000,
    spendPeriodDays: 90,
  },
  rewards: [
    { category: 'travel', rateText: '5x travel through portal', estimatedRate: 0.05 },
    { category: 'dining', rateText: '3x dining', estimatedRate: 0.03 },
  ],
  perks: ['Trip cancellation insurance', 'Point transfer partners'],
  eligibility: 'Subject to issuer approval',
  applyUrl: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
  sourceUrls: ['https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred'],
  lastCheckedAt: '2026-05-17T00:00:00.000Z',
};

const baseOffer: Offer = {
  id: 'cn-cmbc-dining-2026',
  region: 'CN',
  issuer: '民生银行',
  cardNames: ['民生信用卡'],
  title: '指定餐饮满 200 减 50',
  merchant: '精选餐饮商户',
  category: 'dining',
  startDate: '2026-05-01',
  endDate: '2026-05-31',
  discountType: 'instant-discount',
  valueText: '满 200 减 50',
  estimatedValue: 50,
  currency: 'CNY',
  minSpend: 200,
  maxDiscount: 50,
  quotaText: '每日名额有限，先到先得',
  requiresRegistration: false,
  usageLimit: '每用户每月 1 次',
  termsSummary: '以银行活动细则为准',
  originalText: '指定餐饮满 200 减 50，每日名额有限。',
  sourceUrl: 'https://creditcard.cmbc.com.cn/',
  sourceReliability: 'official',
  lastCheckedAt: '2026-05-17T00:00:00.000Z',
};

describe('scoreCard', () => {
  it('returns a bounded score with weighted breakdown for a strong travel card', () => {
    const scored = scoreCard(baseCard);

    expect(scored.score).toBeGreaterThanOrEqual(70);
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.scoreBreakdown).toMatchObject({
      welcomeOffer: expect.any(Number),
      rewards: expect.any(Number),
      annualFeeValue: expect.any(Number),
      perks: expect.any(Number),
      flexibility: expect.any(Number),
      accessibility: expect.any(Number),
      transparency: expect.any(Number),
    });
  });

  it('penalizes high annual fees without offsetting value', () => {
    const premiumWithoutPerks = scoreCard({
      ...baseCard,
      annualFee: { amount: 695, currency: 'USD' },
      welcomeOffer: undefined,
      rewards: [{ category: 'other', rateText: '1x everywhere', estimatedRate: 0.01 }],
      perks: [],
    });

    expect(premiumWithoutPerks.score).toBeLessThan(55);
  });
});

describe('scoreOffer', () => {
  it('rewards high effective discounts from official sources', () => {
    const scored = scoreOffer(baseOffer);

    expect(scored.score).toBeGreaterThanOrEqual(70);
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.scoreBreakdown?.effectiveRate).toBeGreaterThan(20);
    expect(scored.scoreBreakdown?.sourceReliability).toBe(5);
  });

  it('deducts risk for installments, random discounts, complexity, and login-targeted offers', () => {
    const safeScore = scoreOffer(baseOffer).score ?? 0;
    const riskyScore = scoreOffer({
      ...baseOffer,
      discountType: 'installment-discount',
      valueText: '随机立减，需报名，分期可能产生手续费，名额极少，仅限定向用户登录后可见',
      quotaText: '名额极少',
      requiresRegistration: true,
      termsSummary: '规则复杂，仅限定向用户，需登录 App。',
      sourceReliability: 'community',
    }).score ?? 0;

    expect(riskyScore).toBeLessThan(safeScore - 15);
  });
});
