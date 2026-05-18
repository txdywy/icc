import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { dedupeOffers } from '../src/crawlers/shared/dedupe';
import { extractCardImage } from '../src/crawlers/shared/extractCardImage';
import { extractDateRange } from '../src/crawlers/shared/extractDates';
import { fetchHtml } from '../src/crawlers/shared/fetchHtml';
import { filterStaleSeedCards } from '../src/crawlers/shared/filterSeedCards';
import { filterStaleSeedOffers } from '../src/crawlers/shared/filterSeedOffers';
import { normalizeMoney } from '../src/crawlers/shared/normalizeMoney';
import { resolvePublicUrl } from '../src/crawlers/shared/resolvePublicUrl';
import { summarizeOfferText } from '../src/crawlers/shared/summarizeOfferText';
import { extractTextBlocks, safeSnippet } from '../src/crawlers/shared/thirdPartyExtractors';
import type { CreditCard, Offer } from '../src/lib/schema';

const offer: Offer = {
  id: 'placeholder',
  region: 'HK',
  issuer: 'Citi HK',
  title: 'Welcome cashback',
  category: 'welcome',
  discountType: 'cashback',
  valueText: 'HK$1,000 cashback',
  estimatedValue: 1000,
  currency: 'HKD',
  endDate: '2026-12-31',
  sourceUrl: 'https://www.citibank.com.hk/',
  sourceReliability: 'official',
  lastCheckedAt: '2026-05-17T00:00:00.000Z',
};

describe('fetchHtml', () => {
  it('cancels non-success response bodies before throwing', async () => {
    let canceled = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(new ReadableStream({ cancel: () => void (canceled = true) }), {
        status: 404,
        statusText: 'Not Found',
      });

    try {
      await expect(fetchHtml('https://example.com/missing')).rejects.toThrow('HTTP 404 Not Found');
      expect(canceled).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('normalizeMoney', () => {
  it('extracts currency and amount from Chinese and English money strings', () => {
    expect(normalizeMoney('满 ¥200 减 50 元')).toEqual({ amount: 200, currency: 'CNY' });
    expect(normalizeMoney('Earn $750 bonus value')).toEqual({ amount: 750, currency: 'USD' });
    expect(normalizeMoney('HK$1,000 cashback')).toEqual({ amount: 1000, currency: 'HKD' });
  });
});

describe('extractDateRange', () => {
  it('extracts ISO date ranges from mixed public-page text', () => {
    expect(extractDateRange('活动期：2026年5月1日至2026年5月31日')).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
    expect(extractDateRange('Valid from 01/05/2026 to 31/05/2026')).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    });
  });
});

describe('filterStaleSeedCards', () => {
  it('drops generated dynamic cards for sources that were checked successfully', () => {
    const stale: CreditCard = {
      id: 'hk-moneyhero-old',
      region: 'HK',
      issuer: 'Citi HK',
      name: 'Citi Cash Back Card',
      rewards: [],
      perks: [],
      sourceUrls: ['https://www.moneyhero.com.hk/'],
      lastCheckedAt: '2026-05-17T00:00:00.000Z',
    };
    const manual: CreditCard = {
      id: 'manual-card',
      region: 'US',
      issuer: 'Manual Bank',
      name: 'Manual Card',
      rewards: [],
      perks: [],
      sourceUrls: ['https://example.com/manual-card'],
      lastCheckedAt: '2026-05-17T00:00:00.000Z',
    };

    expect(filterStaleSeedCards([stale, manual], ['https://www.moneyhero.com.hk/en/credit-card/all'])).toEqual([manual]);
  });

  it('drops old generated cards when a refreshed parser emits the same detail source URL under a new id', () => {
    const stale: CreditCard = {
      id: 'us-uscreditcardguide-chase-sapphire-preferred-csp-review-2025-6-update-75k-offer',
      region: 'US',
      issuer: 'Capital One',
      name: 'Chase Sapphire Preferred® (CSP) Review (2025.6 Update: 75k Offer)',
      rewards: [],
      perks: [],
      sourceUrls: ['https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/'],
      lastCheckedAt: '2026-05-17T00:00:00.000Z',
    };
    const corrected: CreditCard = {
      id: 'us-uscreditcardguide-chase-sapphire-preferred-credit-card',
      region: 'US',
      issuer: 'Chase',
      name: 'Chase Sapphire Preferred Credit Card',
      rewards: [],
      perks: [],
      sourceUrls: ['https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/'],
      lastCheckedAt: '2026-05-18T00:00:00.000Z',
    };

    expect(filterStaleSeedCards([stale], corrected.sourceUrls)).toEqual([]);
  });

  it('keeps stale cards from sources that failed before returning a result', () => {
    const stale: CreditCard = {
      id: 'cn-cardbaobao-old',
      region: 'CN',
      issuer: '招商银行',
      name: '招商银行经典白金信用卡',
      rewards: [],
      perks: [],
      sourceUrls: ['https://www.cardbaobao.com/card/'],
      lastCheckedAt: '2026-05-17T00:00:00.000Z',
    };

    expect(filterStaleSeedCards([stale], [])).toEqual([stale]);
  });

  it('does not drop unrelated official cards from the same broad host', () => {
    const stale: CreditCard = {
      id: 'us-chase-sapphire-preferred',
      region: 'US',
      issuer: 'Chase',
      name: 'Chase Sapphire Preferred',
      rewards: [],
      perks: [],
      sourceUrls: ['https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred'],
      lastCheckedAt: '2026-05-17T00:00:00.000Z',
    };

    expect(filterStaleSeedCards([stale], ['https://creditcards.chase.com/'])).toEqual([stale]);
  });
});

describe('filterStaleSeedOffers', () => {
  it('drops generated dynamic offers for sources that are crawled again', () => {
    const stale = { ...offer, id: 'hk-mox-old', issuer: 'Mox Bank', sourceUrl: 'https://mox.com/promotions/' };
    const manual = { ...offer, id: 'manual-offer', issuer: 'Manual Bank', sourceUrl: 'https://example.com/manual' };

    expect(filterStaleSeedOffers([stale, manual], ['https://mox.com/promotions/'])).toEqual([manual]);
  });

  it('drops old offers for issuers that were refreshed from a successful crawl', () => {
    const stale = { ...offer, id: 'hk-mox-pdf-old', issuer: 'Mox Bank', sourceUrl: 'https://mox.com/static/terms.pdf' };
    const manual = { ...offer, id: 'manual-offer', issuer: 'Manual Bank', sourceUrl: 'https://example.com/manual' };

    expect(filterStaleSeedOffers([stale, manual], [], ['Mox Bank'])).toEqual([manual]);
  });
});

describe('summarizeOfferText', () => {
  it('creates Chinese display text while preserving amount cues from English source text', () => {
    expect(summarizeOfferText('Welcome OfferJoin Mox with "MOXPAYROLL" and earn up to HKD1,600')).toBe('迎新优惠，最高约 HK$1,600');
    expect(summarizeOfferText('Mox Credit cashback promotion at Xiaomi')).toBe('Mox Credit 信用卡现金回赠优惠');
    expect(summarizeOfferText('Asia Miles promotion')).toBe('Asia Miles 里程优惠');
    expect(summarizeOfferText('Mox Invest Triple $0 Rewards Welcome Offer Promotion Terms and Conditions')).toBe('迎新优惠');
    expect(summarizeOfferText('Chase Sapphire Preferred 80,000 points after $4,000 spend in 3 months')).toBe('开卡奖励优惠，最高约 80,000 点');
    expect(summarizeOfferText('MoneyHero exclusive welcome offer HK$2,000 Apple Store Gift Card')).toBe('迎新优惠，最高约 HK$2,000');
    expect(summarizeOfferText('信用卡支付满200减30，限指定商户')).toBe('信用卡优惠，最高约 ¥200');
    expect(summarizeOfferText('什么值得买 爆料：银联信用卡餐饮返现活动')).toBe('现金回赠优惠');
    expect(summarizeOfferText('开卡奖励 80000 points')).toBe('开卡奖励优惠，最高约 80,000 点');
    expect(summarizeOfferText('Open account welcome offer HK$500')).toBe('迎新优惠，最高约 HK$500');
  });
});

describe('dedupeOffers', () => {
  it('generates stable ids and removes duplicate source/title/endDate/issuer offers', () => {
    const result = dedupeOffers([
      { ...offer, id: 'first' },
      { ...offer, id: 'second', valueText: 'duplicate copy' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('hk-citi-hk-welcome-cashback-2026-12-31');
  });
});

describe('resolvePublicUrl', () => {
  it('returns the source page for javascript, empty, and non-http hrefs', () => {
    expect(resolvePublicUrl('javascript:;', 'https://creditcard.cmbc.com.cn/')).toBe('https://creditcard.cmbc.com.cn/');
    expect(resolvePublicUrl('', 'https://creditcard.cmbc.com.cn/')).toBe('https://creditcard.cmbc.com.cn/');
    expect(resolvePublicUrl('mailto:test@example.com', 'https://creditcard.cmbc.com.cn/')).toBe('https://creditcard.cmbc.com.cn/');
  });

  it('resolves relative public HTTP links against the source page', () => {
    expect(resolvePublicUrl('/offers/page.html', 'https://mox.com/promotions/')).toBe('https://mox.com/offers/page.html');
  });
});

describe('thirdPartyExtractors', () => {
  it('extracts unique useful text blocks with resolved public source URLs', () => {
    const $ = cheerio.load(`
      <main>
        <article><a href="/card/a">Chase Sapphire Preferred 80,000 points after $4,000 spend</a></article>
        <article><a href="/card/a">Chase Sapphire Preferred 80,000 points after $4,000 spend</a></article>
        <article><a href="javascript:;">短</a></article>
        <article><a href="/card/b">Capital One Venture X welcome bonus with annual travel credit</a></article>
      </main>
    `);

    expect(extractTextBlocks($, 'article', 'https://example.com/cards/')).toEqual([
      {
        text: 'Chase Sapphire Preferred 80,000 points after $4,000 spend',
        sourceUrl: 'https://example.com/card/a',
      },
      {
        text: 'Capital One Venture X welcome bonus with annual travel credit',
        sourceUrl: 'https://example.com/card/b',
      },
    ]);
  });

  it('creates whitespace-normalized snippets without cutting surrogate pairs', () => {
    expect(safeSnippet('  Mox Credit   迎新优惠 🎁 最高 HK$1,600  ', 22)).toBe('Mox Credit 迎新优惠 🎁...');
  });
});

describe('extractCardImage', () => {
  it('prefers public card-shaped images near the card name', () => {
    const $ = cheerio.load(`
      <main>
        <img src="/brand-logo.svg" alt="Bank logo" />
        <section>
          <h1>Chase Sapphire Preferred</h1>
          <img src="/cards/sapphire-preferred.png" alt="Chase Sapphire Preferred card art" width="640" height="400" />
        </section>
        <meta property="og:image" content="/fallback.jpg" />
      </main>
    `);

    expect(extractCardImage($, 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred', ['Chase Sapphire Preferred'])).toEqual({
      url: 'https://creditcards.chase.com/cards/sapphire-preferred.png',
      alt: 'Chase Sapphire Preferred card art',
      sourceUrl: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
    });
  });

  it('falls back to og:image when no card-specific image is present', () => {
    const $ = cheerio.load('<meta property="og:image" content="https://example.com/card-preview.jpg" />');

    expect(extractCardImage($, 'https://example.com/cards', ['Example Card'])).toEqual({
      url: 'https://example.com/card-preview.jpg',
      alt: 'Example Card卡面图',
      sourceUrl: 'https://example.com/cards',
    });
  });

  it('ignores likely bank logos when no card image is present', () => {
    const $ = cheerio.load('<img src="/images/bank.png" width="360" height="320" />');

    expect(extractCardImage($, 'https://creditcard.cmbc.com.cn/', ['民生信用卡'])).toBeUndefined();
  });

  it('ignores og images that look like bank assets instead of card art', () => {
    const $ = cheerio.load('<meta property="og:image" content="https://creditcard.cmbc.com.cn/tyglweb/statics/CN/PC/images/bank.png" />');

    expect(extractCardImage($, 'https://creditcard.cmbc.com.cn/', ['民生信用卡'])).toBeUndefined();
  });
});
