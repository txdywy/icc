import { describe, expect, it } from 'vitest';
import { parseHongKongCardHtml } from '../src/crawlers/hk/hongkongcard';
import { parseMoneyHeroHtml } from '../src/crawlers/hk/moneyhero';

const now = new Date('2026-05-17T00:00:00.000Z');

describe('MoneyHero HK parser', () => {
  it('extracts card and welcome offer data from static listing HTML', () => {
    const result = parseMoneyHeroHtml(
      `
        <main>
          <article class="card-product">
            <a href="/en/credit-card/citi-cash-back-card">Citi Cash Back Card</a>
            <p>HK$2,000 welcome offer</p>
            <p>Annual fee HK$1,800</p>
            <p>Minimum income HK$150,000</p>
          </article>
        </main>
      `,
      now,
    );

    expect(result.source.id).toBe('hk-moneyhero');
    expect(result.cards.length).toBeGreaterThanOrEqual(1);
    expect(result.offers.length).toBeGreaterThanOrEqual(1);

    const card = result.cards[0];
    expect(card).toMatchObject({ region: 'HK', issuer: 'Citi HK' });
    expect(card?.sourceUrls).toContain('https://www.moneyhero.com.hk/en/credit-card/citi-cash-back-card');

    const offer = result.offers[0];
    expect(offer).toMatchObject({
      sourceReliability: 'aggregator',
      sourceUrl: 'https://www.moneyhero.com.hk/en/credit-card/citi-cash-back-card',
    });
    expect(offer?.valueText).toContain('迎新优惠');
    expect(offer?.valueText).toContain('HK$2,000');
    expect(offer?.originalText).toBeTruthy();
    expect(offer?.termsSummary).toMatch(/第三方|MoneyHero/);
  });

  it('skips broad contaminated page blocks instead of mixing unrelated MoneyHero products', () => {
    const result = parseMoneyHeroHtml(
      `
        <main>
          <section class="page-results">
            <h1>All credit cards</h1>
            <p>Citi Cash Back Card</p>
            <p>Mox Credit 72,000 points welcome offer</p>
            <p>Annual fee HK$0 and income details vary by product</p>
          </section>
        </main>
      `,
      now,
    );

    expect(result.cards).toHaveLength(0);
    expect(result.offers).toHaveLength(0);
    expect(result.offers.some((offer) => /Mox|72,000 点/.test(offer.valueText))).toBe(false);
  });
});

describe('HongKongCard parser', () => {
  it('extracts card and welcome offer data from static listing HTML', () => {
    const result = parseHongKongCardHtml(
      `
        <main>
          <div class="card-item">
            <a href="/cards/citi-cash-back">Citi Cash Back 信用卡 迎新 HK$1,600 現金回贈</a>
          </div>
        </main>
      `,
      now,
    );

    expect(result.source.id).toBe('hk-hongkongcard');
    expect(result.cards.length).toBeGreaterThanOrEqual(1);
    expect(result.offers.length).toBeGreaterThanOrEqual(1);

    const card = result.cards[0];
    expect(card).toMatchObject({ issuer: 'Citi HK' });

    const offer = result.offers[0];
    expect(offer).toMatchObject({ issuer: 'Citi HK', category: 'welcome', sourceReliability: 'aggregator' });
    expect(offer?.title).toContain('迎新');
    expect(offer?.valueText).toContain('迎新优惠');
    expect(offer?.valueText).toContain('HK$1,600');
    expect(offer?.originalText).toBeTruthy();
  });

  it('skips broad contaminated page blocks instead of mixing unrelated HongKongCard products', () => {
    const result = parseHongKongCardHtml(
      `
        <main>
          <section class="site-content">
            <nav>信用卡比較 最佳信用卡 里數信用卡 迎新優惠</nav>
            <p>Citi Cash Back 信用卡</p>
            <p>Asia Miles 迎新 HK$800</p>
          </section>
        </main>
      `,
      now,
    );

    expect(result.cards).toHaveLength(0);
    expect(result.offers).toHaveLength(0);
    expect(result.offers.some((offer) => /Asia Miles/.test(offer.valueText))).toBe(false);
  });

  it('skips generic HK offer text without confident issuer and card inference', () => {
    const moneyHeroResult = parseMoneyHeroHtml(
      `
        <main>
          <article>
            <a href="/en/credit-card/mystery-card">Generic Hong Kong Credit Card welcome offer HK$800 annual fee waived</a>
          </article>
        </main>
      `,
      now,
    );
    const hongKongCardResult = parseHongKongCardHtml(
      `
        <main>
          <div>
            <a href="/cards/mystery-card">精選信用卡 迎新 HK$800 現金回贈</a>
          </div>
        </main>
      `,
      now,
    );

    expect(moneyHeroResult.cards).toHaveLength(0);
    expect(moneyHeroResult.offers).toHaveLength(0);
    expect(hongKongCardResult.cards).toHaveLength(0);
    expect(hongKongCardResult.offers).toHaveLength(0);
    expect([...moneyHeroResult.cards, ...hongKongCardResult.cards].some((card) => card.issuer === 'Citi HK')).toBe(false);
  });
});
