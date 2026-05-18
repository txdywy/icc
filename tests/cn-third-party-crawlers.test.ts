import { describe, expect, it } from 'vitest';
import { parseCardbaobaoHtml } from '../src/crawlers/cn/cardbaobao';
import { parseSmzdmHtml } from '../src/crawlers/cn/smzdm';

const now = new Date('2026-05-17T00:00:00.000Z');

describe('SMZDM credit card parser', () => {
  it('extracts community credit-card offer signals from static article HTML', () => {
    const result = parseSmzdmHtml(
      `
        <main>
          <article class="feed-row-wide">
            <a href="/p/12345/">银联信用卡餐饮返现活动 满200减30 需报名</a>
            <p>什么值得买社区编辑整理，实际优惠以银行和商户条款为准。</p>
          </article>
        </main>
      `,
      now,
    );

    expect(result.source.id).toBe('cn-smzdm-credit-card');
    expect(result.cards).toHaveLength(0);
    expect(result.offers.length).toBeGreaterThanOrEqual(1);

    const offer = result.offers[0];
    expect(offer).toMatchObject({
      issuer: '银联',
      sourceReliability: 'community',
      sourceUrl: 'https://www.smzdm.com/p/12345/',
    });
    expect(offer?.valueText).toMatch(/现金回赠优惠|信用卡优惠/);
    expect(offer?.originalText).toBeTruthy();
    expect(offer?.termsSummary).toMatch(/社区|线索/);
  });
});

describe('Cardbaobao credit card parser', () => {
  it('extracts card and offer signals from static card-center HTML', () => {
    const result = parseCardbaobaoHtml(
      `
        <main>
          <section class="card-list-item">
            <a href="/card/cmb-classic-platinum.html">招商银行经典白金信用卡 年费 ¥3600 积分权益 新户优惠</a>
          </section>
        </main>
      `,
      now,
    );

    expect(result.source.id).toBe('cn-cardbaobao');
    expect(result.cards.length).toBeGreaterThanOrEqual(1);

    const card = result.cards[0];
    expect(card).toMatchObject({ issuer: '招商银行' });
    expect(card?.name).toContain('经典白金信用卡');
    expect(card?.sourceUrls).toContain('https://www.cardbaobao.com/card/cmb-classic-platinum.html');

    if (result.offers.length > 0) {
      expect(result.offers[0]?.sourceReliability).toBe('aggregator');
    }
    expect([card?.eligibility, result.offers[0]?.termsSummary].filter(Boolean).join(' ')).toMatch(/官方|银行.*条款/);
  });

  it('skips generic unrelated third-party text without confident card or issuer signals', () => {
    const smzdmResult = parseSmzdmHtml(
      `
        <main>
          <article>
            <a href="/p/999/">今日家电好价合集 厨房用品限时折扣</a>
          </article>
        </main>
      `,
      now,
    );
    const cardbaobaoResult = parseCardbaobaoHtml(
      `
        <main>
          <section>
            <a href="/news/888.html">贷款资讯和生活消费技巧合集</a>
          </section>
        </main>
      `,
      now,
    );

    expect(smzdmResult.cards).toHaveLength(0);
    expect(smzdmResult.offers).toHaveLength(0);
    expect(cardbaobaoResult.cards).toHaveLength(0);
    expect(cardbaobaoResult.offers).toHaveLength(0);
  });
});
