# CardRadar Data Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand CardRadar’s static data coverage with a first batch of traceable third-party credit-card sources across Mainland China, the United States, and Hong Kong while keeping official sources canonical.

**Architecture:** Add focused source parser modules that reuse the existing `SourceConfig`, `CrawlResult`, `fetchHtml`, `resolvePublicUrl`, scoring, and region-file merge pipeline. Third-party pages are treated as supplemental intelligence: `aggregator` pages may emit cards and offers, `community` pages emit only low-authority offer/article signals, and conflicts with official sources are kept separate through `sourceUrl`/`sourceReliability` rather than overwriting official records.

**Tech Stack:** Astro static site, TypeScript strict mode, Cheerio crawlers, Zod validation, Vitest, public JSON files in `public/data`.

---

## File Structure

- Modify `src/crawlers/shared/summarizeOfferText.ts`
  - Extend Chinese summary support for article/guide style third-party text, US point bonuses, HK welcome offers, and Mainland cashback/deal language.
- Create `src/crawlers/shared/thirdPartyExtractors.ts`
  - Small reusable helpers for extracting normalized text blocks, source links, and safe snippets from aggregator/community pages.
- Test `tests/crawler-helpers.test.ts`
  - Add focused tests for the helper and summary behavior before implementation.
- Create `src/crawlers/us/us-credit-card-guide.ts`
  - Parse US Credit Card Guide public card pages/index content as `aggregator` card/offer signals.
- Create `src/crawlers/us/doctor-of-credit.ts`
  - Parse Doctor of Credit public best-bonus page as `aggregator` offer signals.
- Create `src/crawlers/hk/moneyhero.ts`
  - Parse MoneyHero HK public credit-card listing as `aggregator` card/offer signals.
- Create `src/crawlers/hk/hongkongcard.ts`
  - Parse HongKongCard public card listing as `aggregator` card/offer signals.
- Create `src/crawlers/cn/smzdm.ts`
  - Parse 什么值得买信用卡频道 as `community` offer/article signals.
- Create `src/crawlers/cn/cardbaobao.ts`
  - Parse 卡宝宝 credit-card public pages as `aggregator` card/offer signals when public HTML is reachable.
- Modify `src/crawlers/index.ts`
  - Register the new parser jobs.
- Modify `public/data/sources.json`
  - Add static source registry entries for the new sources.
- Test with existing commands:
  - `npm test`
  - `npm run crawl`
  - `npm run validate:data`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

**Execution note:** Do not create git commits unless the user explicitly requests commits. The commit steps below describe atomic staging boundaries for future commit work, but in this session they should be treated as review checkpoints, not commands to run.

---

### Task 1: Add Third-Party Extraction Helpers

**Files:**
- Create: `src/crawlers/shared/thirdPartyExtractors.ts`
- Modify: `tests/crawler-helpers.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Append this block to `tests/crawler-helpers.test.ts` and add the import shown below.

```ts
import { extractTextBlocks, safeSnippet } from '../src/crawlers/shared/thirdPartyExtractors';
```

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/crawler-helpers.test.ts
```

Expected: FAIL because `../src/crawlers/shared/thirdPartyExtractors` does not exist.

- [ ] **Step 3: Implement the helper module**

Create `src/crawlers/shared/thirdPartyExtractors.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import { resolvePublicUrl } from './resolvePublicUrl';

export interface TextBlock {
  text: string;
  sourceUrl: string;
}

export function extractTextBlocks($: CheerioAPI, selector: string, sourceUrl: string, minLength = 24): TextBlock[] {
  const seen = new Set<string>();
  const blocks: TextBlock[] = [];

  $(selector).each((_, element) => {
    const text = normalizeText($(element).text());
    if (text.length < minLength) return;

    const href = $(element).is('a') ? $(element).attr('href') : $(element).find('a').first().attr('href');
    const resolvedUrl = resolvePublicUrl(href, sourceUrl);
    const key = `${resolvedUrl}|${text}`.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    blocks.push({ text, sourceUrl: resolvedUrl });
  });

  return blocks;
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function safeSnippet(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  const chars = [...normalized];
  return chars.length > maxLength ? `${chars.slice(0, maxLength).join('').trim()}...` : normalized;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- tests/crawler-helpers.test.ts
```

Expected: PASS for the new `thirdPartyExtractors` tests and existing crawler helper tests.

- [ ] **Step 5: Review checkpoint**

Review changed files:

```bash
git diff -- tests/crawler-helpers.test.ts src/crawlers/shared/thirdPartyExtractors.ts
```

Expected: only the helper tests and helper module changed.

---

### Task 2: Improve Chinese Summary Coverage for Third-Party Text

**Files:**
- Modify: `tests/crawler-helpers.test.ts`
- Modify: `src/crawlers/shared/summarizeOfferText.ts`

- [ ] **Step 1: Write failing summary tests**

Add these expectations to the existing `describe('summarizeOfferText', ...)` block in `tests/crawler-helpers.test.ts`:

```ts
expect(summarizeOfferText('Chase Sapphire Preferred 80,000 points after $4,000 spend in 3 months')).toBe('开卡奖励优惠，最高约 80,000 点');
expect(summarizeOfferText('MoneyHero exclusive welcome offer HK$2,000 Apple Store Gift Card')).toBe('迎新优惠，最高约 HK$2,000');
expect(summarizeOfferText('信用卡支付满200减30，限指定商户')).toBe('信用卡优惠，最高约 ¥200');
expect(summarizeOfferText('什么值得买 爆料：银联信用卡餐饮返现活动')).toBe('现金回赠优惠');
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/crawler-helpers.test.ts
```

Expected: FAIL because point-bonus and Mainland/HK aggregator text does not summarize as specified.

- [ ] **Step 3: Update `summarizeOfferText`**

Replace `src/crawlers/shared/summarizeOfferText.ts` with:

```ts
export function summarizeOfferText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const points = extractPoints(normalized);
  const amount = extractAmount(normalized);
  const category = inferCategoryLabel(normalized);
  const value = points ? `，最高约 ${points} 点` : amount ? `，最高约 ${amount}` : '';

  if (/mox\s+credit/i.test(normalized)) return `Mox Credit 信用卡${category}${value}`;
  if (/asia\s+miles|里數/i.test(normalized)) return `Asia Miles ${category}${value}`;
  return `${category}${value}`;
}

function inferCategoryLabel(text: string): string {
  if (/welcome|迎新|new customer|new customers|join|open an account|开卡|首刷/i.test(text)) return '迎新优惠';
  if (/sign[ -]?up|bonus|points after|miles after|开卡奖励/i.test(text)) return '开卡奖励优惠';
  if (/cashback|cash back|cash rebate|回贈|返现|现金/i.test(text)) return '现金回赠优惠';
  if (/miles|里數|里程/i.test(text)) return '里程优惠';
  if (/promo code|code|coupon|voucher|優惠碼|券/i.test(text)) return '优惠码活动';
  if (/installment|instalment|分期/i.test(text)) return '分期优惠';
  if (/discount|offer|promotion|优惠|折扣|满\s*\d+\s*减\s*\d+/i.test(text)) return '信用卡优惠';
  return '公开优惠';
}

function extractAmount(text: string): string | undefined {
  const normalized = text.replace(/,/g, '');
  const hkd = normalized.match(/(?:HK\$|HKD)\s*(\d+(?:\.\d+)?)/i);
  if (hkd?.[1]) return formatPositiveAmount(Number(hkd[1]), 'HK$');

  const usd = normalized.match(/(?:US\$|USD|\$)\s*(\d+(?:\.\d+)?)/i);
  if (usd?.[1]) return formatPositiveAmount(Number(usd[1]), 'US$');

  const cny = normalized.match(/(?:¥|￥|CNY|RMB|满)\s*(\d+(?:\.\d+)?)/i);
  if (cny?.[1]) return formatPositiveAmount(Number(cny[1]), '¥');

  return undefined;
}

function extractPoints(text: string): string | undefined {
  const points = text.replace(/,/g, '').match(/(\d{2,6})\s*(?:points|pts|membership rewards|ultimate rewards|miles|里程|积分)/i);
  if (!points?.[1]) return undefined;
  const amount = Number(points[1]);
  return amount > 0 ? amount.toLocaleString('en-US') : undefined;
}

function formatPositiveAmount(amount: number, prefix: string): string | undefined {
  return amount > 0 ? `${prefix}${amount.toLocaleString('en-US')}` : undefined;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- tests/crawler-helpers.test.ts
```

Expected: PASS for all crawler helper tests.

- [ ] **Step 5: Review checkpoint**

Review changed files:

```bash
git diff -- tests/crawler-helpers.test.ts src/crawlers/shared/summarizeOfferText.ts
```

Expected: summary behavior changed only through tests and `summarizeOfferText`.

---

### Task 3: Add US Credit Card Guide Aggregator Parser

**Files:**
- Create: `src/crawlers/us/us-credit-card-guide.ts`
- Modify: `src/crawlers/index.ts`
- Modify: `public/data/sources.json`

- [ ] **Step 1: Create parser module**

Create `src/crawlers/us/us-credit-card-guide.ts`:

```ts
import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const usCreditCardGuideSource: SourceConfig = {
  id: 'us-uscreditcardguide',
  region: 'US',
  name: '美国信用卡指南信用卡资料页',
  url: 'https://www.uscreditcardguide.com/credit-cards-en/',
  reliability: 'aggregator',
};

const cardPageUrls = [
  'https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/',
  'https://www.uscreditcardguide.com/capital-one-venture-x-credit-card/',
];

export async function crawlUsCreditCardGuide(now = new Date()): Promise<CrawlResult> {
  const pages = await Promise.all(cardPageUrls.map(async (url) => ({ url, html: await fetchHtml(url) })));
  const cards: CreditCard[] = [];
  const offers: Offer[] = [];

  for (const page of pages) {
    const $ = cheerio.load(page.html);
    const title = $('h1').first().text().replace(/\s+/g, ' ').trim();
    const bodyText = $('article, main, body').first().text().replace(/\s+/g, ' ').trim();
    const name = title.replace(/\s*信用卡.*$/i, '').replace(/\s*Credit Card.*$/i, ' Credit Card').trim();
    if (!name || !/card|信用卡/i.test(`${name} ${bodyText}`)) continue;

    const annualFee = normalizeMoney(matchText(bodyText, /annual fee[^$]{0,60}\$?\d+[\d,]*/i) ?? '');
    const welcomeValue = extractWelcomeValue(bodyText);
    const spendRequirement = extractSpendRequirement(bodyText);
    const issuer = inferIssuer(name);
    const summary = summarizeOfferText(bodyText);

    cards.push(
      scoreCard({
        id: stableCardId(name),
        region: 'US',
        issuer,
        name,
        annualFee: annualFee ? { amount: annualFee.amount, currency: annualFee.currency } : undefined,
        welcomeOffer: welcomeValue
          ? {
              headline: summary,
              estimatedValue: welcomeValue,
              currency: 'USD',
              spendRequirement,
              spendPeriodDays: /3 months|90 days/i.test(bodyText) ? 90 : undefined,
            }
          : undefined,
        rewards: [{ category: 'daily', rateText: '第三方资料整理的积分/返现结构，具体倍率以官方条款为准', estimatedRate: 0.02 }],
        perks: ['第三方中文资料页', '历史奖励与申请规则参考'],
        eligibility: '第三方资料仅供参考，申请资格以银行官方条款为准',
        sourceUrls: [page.url],
        lastCheckedAt: now.toISOString(),
      }),
    );

    if (welcomeValue || /bonus|points|miles|开卡|welcome/i.test(bodyText)) {
      offers.push(
        scoreOffer(
          {
            id: `${stableCardId(name)}-welcome-usccg`,
            region: 'US',
            issuer,
            cardNames: [name],
            title: `${name} 第三方开卡奖励记录`,
            category: 'welcome',
            discountType: /miles/i.test(bodyText) ? 'miles' : 'points',
            valueText: summary,
            estimatedValue: welcomeValue,
            currency: 'USD',
            minSpend: spendRequirement,
            requiresRegistration: false,
            usageLimit: '第三方资料页记录，是否仍可申请以官方页面为准',
            termsSummary: safeSnippet(bodyText, 180),
            originalText: safeSnippet(bodyText, 500),
            sourceUrl: page.url,
            sourceReliability: usCreditCardGuideSource.reliability,
            lastCheckedAt: now.toISOString(),
          },
          now,
        ),
      );
    }
  }

  if (cards.length === 0 && offers.length === 0) {
    const indexHtml = await fetchHtml(usCreditCardGuideSource.url);
    const $ = cheerio.load(indexHtml);
    for (const block of extractTextBlocks($, 'article, .post, li', usCreditCardGuideSource.url).slice(0, 10)) {
      if (!/card|信用卡|points|miles|bonus/i.test(block.text)) continue;
      offers.push(
        scoreOffer(
          {
            id: `us-usccg-${offers.length}`,
            region: 'US',
            issuer: inferIssuer(block.text),
            title: summarizeOfferText(block.text),
            category: 'welcome',
            discountType: /miles/i.test(block.text) ? 'miles' : 'points',
            valueText: summarizeOfferText(block.text),
            termsSummary: `${safeSnippet(block.text, 180)}，第三方资料仅供参考。`,
            originalText: block.text,
            sourceUrl: block.sourceUrl,
            sourceReliability: usCreditCardGuideSource.reliability,
            lastCheckedAt: now.toISOString(),
          },
          now,
        ),
      );
    }
  }

  return { source: usCreditCardGuideSource, cards, offers: offers.slice(0, 20) };
}

function matchText(text: string, pattern: RegExp): string | undefined {
  return text.match(pattern)?.[0];
}

function extractWelcomeValue(text: string): number | undefined {
  const points = text.replace(/,/g, '').match(/(\d{2,6})\s*(?:points|miles|pts)/i);
  if (points?.[1]) return Number(points[1]);
  const money = normalizeMoney(text);
  return money?.currency === 'USD' ? money.amount : undefined;
}

function extractSpendRequirement(text: string): number | undefined {
  const spend = text.replace(/,/g, '').match(/spend[^$]{0,40}\$\s*(\d+)/i);
  return spend?.[1] ? Number(spend[1]) : undefined;
}

function inferIssuer(text: string): string {
  if (/chase/i.test(text)) return 'Chase';
  if (/capital one/i.test(text)) return 'Capital One';
  if (/american express|amex/i.test(text)) return 'American Express';
  if (/citi/i.test(text)) return 'Citi';
  return 'US Credit Card Guide';
}

function stableCardId(name: string): string {
  return `us-usccg-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}
```

- [ ] **Step 2: Register parser in `src/crawlers/index.ts`**

Add import near other US imports:

```ts
import { crawlUsCreditCardGuide, usCreditCardGuideSource } from './us/us-credit-card-guide';
```

Add job after existing official US jobs:

```ts
  { parser: crawlUsCreditCardGuide, source: usCreditCardGuideSource },
```

- [ ] **Step 3: Add source registry entry**

Insert this object in `public/data/sources.json` after the existing US official sources:

```json
  {
    "id": "us-uscreditcardguide",
    "region": "US",
    "name": "美国信用卡指南信用卡资料页",
    "url": "https://www.uscreditcardguide.com/credit-cards-en/",
    "reliability": "aggregator"
  }
```

Keep valid JSON commas.

- [ ] **Step 4: Run typecheck for parser shape**

Run:

```bash
npm run typecheck
```

Expected: PASS. If it fails on `exactOptionalPropertyTypes`, remove explicit `undefined` optional properties using conditional object spreads.

- [ ] **Step 5: Review checkpoint**

Review changed files:

```bash
git diff -- src/crawlers/us/us-credit-card-guide.ts src/crawlers/index.ts public/data/sources.json
```

Expected: one new US aggregator parser, one parser registration, one source registry entry.

---

### Task 4: Add Doctor of Credit Best-Bonus Parser

**Files:**
- Create: `src/crawlers/us/doctor-of-credit.ts`
- Modify: `src/crawlers/index.ts`
- Modify: `public/data/sources.json`

- [ ] **Step 1: Create parser module**

Create `src/crawlers/us/doctor-of-credit.ts`:

```ts
import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const doctorOfCreditSource: SourceConfig = {
  id: 'us-doctor-of-credit',
  region: 'US',
  name: 'Doctor of Credit 当前开卡奖励汇总',
  url: 'https://www.doctorofcredit.com/best-current-credit-card-sign-bonuses/',
  reliability: 'aggregator',
};

export async function crawlDoctorOfCredit(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(doctorOfCreditSource.url);
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'article li, article p, article h2, article h3', doctorOfCreditSource.url, 32);
  const offers: Offer[] = [];

  for (const block of blocks) {
    if (!/(bonus|points|miles|cash|statement credit|spend|annual fee)/i.test(block.text)) continue;
    if (!/(chase|capital one|american express|amex|citi|bank of america|wells fargo|us bank)/i.test(block.text)) continue;

    const issuer = inferIssuer(block.text);
    const summary = summarizeOfferText(block.text);
    offers.push(
      scoreOffer(
        {
          id: `us-doc-${offers.length}`,
          region: 'US',
          issuer,
          title: `${issuer} 第三方开卡奖励线索`,
          category: 'welcome',
          discountType: /cash|statement credit/i.test(block.text) ? 'cashback' : /miles/i.test(block.text) ? 'miles' : 'points',
          valueText: summary,
          minSpend: extractSpendRequirement(block.text),
          requiresRegistration: /targeted|ymmv|activation/i.test(block.text),
          usageLimit: /targeted|ymmv/i.test(block.text) ? '可能是定向或 YMMV 优惠' : '公开页面整理，需以银行官方条款确认',
          termsSummary: `${safeSnippet(block.text, 180)}，Doctor of Credit 为第三方汇总来源。`,
          originalText: block.text,
          sourceUrl: block.sourceUrl,
          sourceReliability: doctorOfCreditSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  }

  return { source: doctorOfCreditSource, cards: [], offers: offers.slice(0, 25) };
}

function inferIssuer(text: string): string {
  if (/chase/i.test(text)) return 'Chase';
  if (/capital one/i.test(text)) return 'Capital One';
  if (/american express|amex/i.test(text)) return 'American Express';
  if (/citi/i.test(text)) return 'Citi';
  if (/bank of america/i.test(text)) return 'Bank of America';
  if (/wells fargo/i.test(text)) return 'Wells Fargo';
  if (/us bank|u\.s\. bank/i.test(text)) return 'U.S. Bank';
  return 'Doctor of Credit';
}

function extractSpendRequirement(text: string): number | undefined {
  const spend = text.replace(/,/g, '').match(/spend[^$]{0,50}\$\s*(\d+)/i);
  return spend?.[1] ? Number(spend[1]) : undefined;
}
```

- [ ] **Step 2: Register parser in `src/crawlers/index.ts`**

Add import near other US imports:

```ts
import { crawlDoctorOfCredit, doctorOfCreditSource } from './us/doctor-of-credit';
```

Add job after `crawlUsCreditCardGuide`:

```ts
  { parser: crawlDoctorOfCredit, source: doctorOfCreditSource },
```

- [ ] **Step 3: Add source registry entry**

Insert in `public/data/sources.json` after the US Credit Card Guide entry:

```json
  {
    "id": "us-doctor-of-credit",
    "region": "US",
    "name": "Doctor of Credit 当前开卡奖励汇总",
    "url": "https://www.doctorofcredit.com/best-current-credit-card-sign-bonuses/",
    "reliability": "aggregator"
  }
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Review checkpoint**

Review changed files:

```bash
git diff -- src/crawlers/us/doctor-of-credit.ts src/crawlers/index.ts public/data/sources.json
```

Expected: one new US offer parser, one parser registration, one source registry entry.

---

### Task 5: Add Hong Kong Aggregator Parsers

**Files:**
- Create: `src/crawlers/hk/moneyhero.ts`
- Create: `src/crawlers/hk/hongkongcard.ts`
- Modify: `src/crawlers/index.ts`
- Modify: `public/data/sources.json`

- [ ] **Step 1: Create MoneyHero parser**

Create `src/crawlers/hk/moneyhero.ts`:

```ts
import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const moneyHeroSource: SourceConfig = {
  id: 'hk-moneyhero',
  region: 'HK',
  name: 'MoneyHero HK 信用卡比较页',
  url: 'https://www.moneyhero.com.hk/en/credit-card/all',
  reliability: 'aggregator',
};

export async function crawlMoneyHero(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(moneyHeroSource.url);
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'article, li, [data-testid], .card, .product-card', moneyHeroSource.url, 40);
  const cards: CreditCard[] = [];
  const offers: Offer[] = [];

  for (const block of blocks) {
    if (!/(credit card|cashback|welcome|annual fee|HK\$|income|里數|回贈)/i.test(block.text)) continue;
    const name = inferCardName(block.text);
    if (!name) continue;
    const issuer = inferIssuer(block.text);
    const money = normalizeMoney(block.text);
    const summary = summarizeOfferText(block.text);

    cards.push(
      scoreCard({
        id: `hk-moneyhero-${slug(name)}`,
        region: 'HK',
        issuer,
        name,
        annualFee: /annual fee/i.test(block.text) && money ? { amount: money.amount, currency: 'HKD' } : undefined,
        welcomeOffer: /welcome|gift|cashback|HK\$/i.test(block.text)
          ? {
              headline: summary,
              estimatedValue: money?.currency === 'HKD' ? money.amount : undefined,
              currency: 'HKD',
            }
          : undefined,
        rewards: [{ category: /miles|里數/i.test(block.text) ? 'travel' : 'cashback', rateText: '第三方比较页整理的回赠或里程信息，具体以官方条款为准', estimatedRate: 0.02 }],
        perks: ['MoneyHero HK 比较页资料', '迎新和回赠信息需以银行官方条款确认'],
        eligibility: /income/i.test(block.text) ? safeSnippet(block.text, 120) : '申请资格以发卡机构官方条款为准',
        sourceUrls: [block.sourceUrl],
        lastCheckedAt: now.toISOString(),
      }),
    );

    offers.push(
      scoreOffer(
        {
          id: `hk-moneyhero-${offers.length}`,
          region: 'HK',
          issuer,
          cardNames: [name],
          title: `${name} 第三方迎新/回赠资料`,
          category: /miles|里數/i.test(block.text) ? 'travel' : 'welcome',
          discountType: /miles|里數/i.test(block.text) ? 'miles' : 'cashback',
          valueText: summary,
          estimatedValue: money?.currency === 'HKD' ? money.amount : undefined,
          currency: 'HKD',
          termsSummary: `${safeSnippet(block.text, 180)}，MoneyHero 为第三方比较来源。`,
          originalText: block.text,
          sourceUrl: block.sourceUrl,
          sourceReliability: moneyHeroSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  }

  return { source: moneyHeroSource, cards: dedupeCards(cards).slice(0, 20), offers: offers.slice(0, 20) };
}

function inferCardName(text: string): string | undefined {
  const match = text.match(/([A-Z][A-Za-z0-9 &,+-]{4,80}(?:Card|Credit Card|Visa|Mastercard|American Express))/);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

function inferIssuer(text: string): string {
  if (/citi/i.test(text)) return 'Citi HK';
  if (/hsbc/i.test(text)) return 'HSBC HK';
  if (/standard chartered/i.test(text)) return 'Standard Chartered HK';
  if (/hang seng/i.test(text)) return 'Hang Seng Bank';
  if (/american express|amex/i.test(text)) return 'American Express HK';
  return 'MoneyHero HK';
}

function dedupeCards(cards: CreditCard[]): CreditCard[] {
  return [...new Map(cards.map((card) => [card.id, card])).values()];
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

- [ ] **Step 2: Create HongKongCard parser**

Create `src/crawlers/hk/hongkongcard.ts`:

```ts
import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const hongKongCardSource: SourceConfig = {
  id: 'hk-hongkongcard',
  region: 'HK',
  name: 'HongKongCard 信用卡比较页',
  url: 'https://www.hongkongcard.com/cards',
  reliability: 'aggregator',
};

export async function crawlHongKongCard(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(hongKongCardSource.url);
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'a, article, li, .card, .credit-card', hongKongCardSource.url, 32);
  const cards: CreditCard[] = [];
  const offers: Offer[] = [];

  for (const block of blocks) {
    if (!/(信用卡|迎新|回贈|里數|現金|年費|簽賬|cashback|miles|welcome)/i.test(block.text)) continue;
    const issuer = inferIssuer(block.text);
    const name = inferCardName(block.text, issuer);
    const money = normalizeMoney(block.text);
    const summary = summarizeOfferText(block.text);

    if (name) {
      cards.push(
        scoreCard({
          id: `hk-hongkongcard-${slug(`${issuer}-${name}`)}`,
          region: 'HK',
          issuer,
          name,
          welcomeOffer: /迎新|welcome|HK\$/i.test(block.text)
            ? {
                headline: summary,
                estimatedValue: money?.currency === 'HKD' ? money.amount : undefined,
                currency: 'HKD',
              }
            : undefined,
          rewards: [{ category: /里數|miles/i.test(block.text) ? 'travel' : 'cashback', rateText: 'HongKongCard 整理的回赠或里数资料，具体以官方条款为准', estimatedRate: 0.02 }],
          perks: ['香港本地第三方信用卡资料', '迎新/回赠资料需以银行官方条款确认'],
          eligibility: '申请资格以发卡机构官方条款为准',
          sourceUrls: [block.sourceUrl],
          lastCheckedAt: now.toISOString(),
        }),
      );
    }

    offers.push(
      scoreOffer(
        {
          id: `hk-hongkongcard-${offers.length}`,
          region: 'HK',
          issuer,
          ...(name ? { cardNames: [name] } : {}),
          title: name ? `${name} 第三方优惠资料` : summary,
          category: /里數|miles/i.test(block.text) ? 'travel' : /餐|dining/i.test(block.text) ? 'dining' : 'welcome',
          discountType: /里數|miles/i.test(block.text) ? 'miles' : 'cashback',
          valueText: summary,
          estimatedValue: money?.currency === 'HKD' ? money.amount : undefined,
          currency: 'HKD',
          termsSummary: `${safeSnippet(block.text, 180)}，HongKongCard 为第三方比较来源。`,
          originalText: block.text,
          sourceUrl: block.sourceUrl,
          sourceReliability: hongKongCardSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  }

  return { source: hongKongCardSource, cards: dedupeCards(cards).slice(0, 20), offers: offers.slice(0, 20) };
}

function inferIssuer(text: string): string {
  if (/citi|花旗/i.test(text)) return 'Citi HK';
  if (/hsbc|滙豐|汇丰/i.test(text)) return 'HSBC HK';
  if (/恒生|hang seng/i.test(text)) return 'Hang Seng Bank';
  if (/渣打|standard chartered/i.test(text)) return 'Standard Chartered HK';
  if (/中銀|boc/i.test(text)) return 'BOC HK';
  return 'HongKongCard';
}

function inferCardName(text: string, issuer: string): string | undefined {
  const english = text.match(/([A-Z][A-Za-z0-9 &,+-]{4,80}(?:Card|Visa|Mastercard|American Express))/)?.[1];
  if (english) return english.replace(/\s+/g, ' ').trim();
  const chinese = text.match(/([一-鿿A-Za-z0-9 ]{2,40}信用卡)/)?.[1];
  return chinese ? `${issuer} ${chinese}`.replace(/\s+/g, ' ').trim() : undefined;
}

function dedupeCards(cards: CreditCard[]): CreditCard[] {
  return [...new Map(cards.map((card) => [card.id, card])).values()];
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');
}
```

- [ ] **Step 3: Register HK parsers in `src/crawlers/index.ts`**

Add imports:

```ts
import { crawlMoneyHero, moneyHeroSource } from './hk/moneyhero';
import { crawlHongKongCard, hongKongCardSource } from './hk/hongkongcard';
```

Add jobs after official HK jobs:

```ts
  { parser: crawlMoneyHero, source: moneyHeroSource },
  { parser: crawlHongKongCard, source: hongKongCardSource },
```

- [ ] **Step 4: Add source registry entries**

Insert in `public/data/sources.json` after existing HK official sources:

```json
  {
    "id": "hk-moneyhero",
    "region": "HK",
    "name": "MoneyHero HK 信用卡比较页",
    "url": "https://www.moneyhero.com.hk/en/credit-card/all",
    "reliability": "aggregator"
  },
  {
    "id": "hk-hongkongcard",
    "region": "HK",
    "name": "HongKongCard 信用卡比较页",
    "url": "https://www.hongkongcard.com/cards",
    "reliability": "aggregator"
  }
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Review checkpoint**

Review changed files:

```bash
git diff -- src/crawlers/hk/moneyhero.ts src/crawlers/hk/hongkongcard.ts src/crawlers/index.ts public/data/sources.json
```

Expected: two new HK aggregator parsers, parser registrations, and source registry entries.

---

### Task 6: Add Mainland Third-Party Parsers

**Files:**
- Create: `src/crawlers/cn/smzdm.ts`
- Create: `src/crawlers/cn/cardbaobao.ts`
- Modify: `src/crawlers/index.ts`
- Modify: `public/data/sources.json`

- [ ] **Step 1: Create 什么值得买 parser**

Create `src/crawlers/cn/smzdm.ts`:

```ts
import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const smzdmSource: SourceConfig = {
  id: 'cn-smzdm-credit-card',
  region: 'CN',
  name: '什么值得买信用卡频道',
  url: 'https://www.smzdm.com/zy/category/av6ko9y/',
  reliability: 'community',
};

export async function crawlSmzdm(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(smzdmSource.url);
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'article, li, .feed-row-wide, .z-feed-content, a', smzdmSource.url, 24);
  const offers: Offer[] = [];

  for (const block of blocks) {
    if (!/(信用卡|银联|银行|返现|满减|支付|优惠|爆料|新户|首刷)/.test(block.text)) continue;
    const money = normalizeMoney(block.text);
    const summary = summarizeOfferText(block.text);
    const issuer = inferIssuer(block.text);
    offers.push(
      scoreOffer(
        {
          id: `cn-smzdm-${offers.length}`,
          region: 'CN',
          issuer,
          title: summary,
          category: /餐|美食/.test(block.text) ? 'dining' : /车|加油|出行/.test(block.text) ? 'transport' : /新户|首刷|开卡/.test(block.text) ? 'welcome' : 'shopping',
          discountType: /返现|回馈|现金/.test(block.text) ? 'cashback' : /积分|里程/.test(block.text) ? 'points' : 'instant-discount',
          valueText: summary,
          estimatedValue: money?.currency === 'CNY' ? money.amount : undefined,
          currency: 'CNY',
          requiresRegistration: /报名|领取|领券|登记/.test(block.text),
          usageLimit: '社区/编辑线索，需回到银行或商户官方条款确认',
          termsSummary: `${safeSnippet(block.text, 180)}，什么值得买内容作为社区线索处理。`,
          originalText: block.text,
          sourceUrl: block.sourceUrl,
          sourceReliability: smzdmSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  }

  return { source: smzdmSource, cards: [], offers: offers.slice(0, 20) };
}

function inferIssuer(text: string): string {
  if (/招商|招行/.test(text)) return '招商银行';
  if (/中信/.test(text)) return '中信银行';
  if (/民生/.test(text)) return '民生银行';
  if (/平安/.test(text)) return '平安银行';
  if (/银联|云闪付/.test(text)) return '银联';
  if (/交通/.test(text)) return '交通银行';
  if (/工商|工行/.test(text)) return '工商银行';
  return '什么值得买';
}
```

- [ ] **Step 2: Create 卡宝宝 parser**

Create `src/crawlers/cn/cardbaobao.ts`:

```ts
import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const cardbaobaoSource: SourceConfig = {
  id: 'cn-cardbaobao',
  region: 'CN',
  name: '卡宝宝信用卡中心',
  url: 'https://www.cardbaobao.com/card/',
  reliability: 'aggregator',
};

export async function crawlCardbaobao(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(cardbaobaoSource.url);
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'a, li, .card, .bank-card, .list-item', cardbaobaoSource.url, 24);
  const cards: CreditCard[] = [];
  const offers: Offer[] = [];

  for (const block of blocks) {
    if (!/(信用卡|白金卡|金卡|普卡|年费|积分|优惠|权益|申请)/.test(block.text)) continue;
    const issuer = inferIssuer(block.text);
    const name = inferCardName(block.text, issuer);
    const money = normalizeMoney(block.text);
    const summary = summarizeOfferText(block.text);

    if (name) {
      cards.push(
        scoreCard({
          id: `cn-cardbaobao-${slug(`${issuer}-${name}`)}`,
          region: 'CN',
          issuer,
          name,
          annualFee: /年费/.test(block.text) && money?.currency === 'CNY' ? { amount: money.amount, currency: 'CNY' } : undefined,
          rewards: [{ category: 'daily', rateText: '第三方信用卡中心整理的权益摘要，具体以银行官方条款为准', estimatedRate: 0.01 }],
          perks: ['卡宝宝信用卡中心资料', '申请与权益需以银行官方条款确认'],
          eligibility: '申请资格以发卡银行官方条款为准',
          sourceUrls: [block.sourceUrl],
          lastCheckedAt: now.toISOString(),
        }),
      );
    }

    if (/优惠|活动|返现|满减|新户|首刷/.test(block.text)) {
      offers.push(
        scoreOffer(
          {
            id: `cn-cardbaobao-${offers.length}`,
            region: 'CN',
            issuer,
            ...(name ? { cardNames: [name] } : {}),
            title: summary,
            category: /新户|首刷|开卡/.test(block.text) ? 'welcome' : 'shopping',
            discountType: /返现|现金/.test(block.text) ? 'cashback' : /积分/.test(block.text) ? 'points' : 'instant-discount',
            valueText: summary,
            estimatedValue: money?.currency === 'CNY' ? money.amount : undefined,
            currency: 'CNY',
            termsSummary: `${safeSnippet(block.text, 180)}，卡宝宝为第三方聚合来源。`,
            originalText: block.text,
            sourceUrl: block.sourceUrl,
            sourceReliability: cardbaobaoSource.reliability,
            lastCheckedAt: now.toISOString(),
          },
          now,
        ),
      );
    }
  }

  return { source: cardbaobaoSource, cards: dedupeCards(cards).slice(0, 20), offers: offers.slice(0, 20) };
}

function inferIssuer(text: string): string {
  if (/招商|招行/.test(text)) return '招商银行';
  if (/中信/.test(text)) return '中信银行';
  if (/民生/.test(text)) return '民生银行';
  if (/平安/.test(text)) return '平安银行';
  if (/交通/.test(text)) return '交通银行';
  if (/工商|工行/.test(text)) return '工商银行';
  if (/建设|建行/.test(text)) return '建设银行';
  return '卡宝宝';
}

function inferCardName(text: string, issuer: string): string | undefined {
  const match = text.match(/([一-鿿A-Za-z0-9 ]{2,40}(?:信用卡|白金卡|金卡|普卡))/)?.[1];
  if (!match) return undefined;
  return match.includes(issuer) ? match.trim() : `${issuer}${match}`.trim();
}

function dedupeCards(cards: CreditCard[]): CreditCard[] {
  return [...new Map(cards.map((card) => [card.id, card])).values()];
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');
}
```

- [ ] **Step 3: Register Mainland parsers in `src/crawlers/index.ts`**

Add imports near other CN imports:

```ts
import { cardbaobaoSource, crawlCardbaobao } from './cn/cardbaobao';
import { crawlSmzdm, smzdmSource } from './cn/smzdm';
```

Add jobs after existing official CN jobs:

```ts
  { parser: crawlSmzdm, source: smzdmSource },
  { parser: crawlCardbaobao, source: cardbaobaoSource },
```

- [ ] **Step 4: Add source registry entries**

Insert in `public/data/sources.json` after existing CN official sources:

```json
  {
    "id": "cn-smzdm-credit-card",
    "region": "CN",
    "name": "什么值得买信用卡频道",
    "url": "https://www.smzdm.com/zy/category/av6ko9y/",
    "reliability": "community"
  },
  {
    "id": "cn-cardbaobao",
    "region": "CN",
    "name": "卡宝宝信用卡中心",
    "url": "https://www.cardbaobao.com/card/",
    "reliability": "aggregator"
  }
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Review checkpoint**

Review changed files:

```bash
git diff -- src/crawlers/cn/smzdm.ts src/crawlers/cn/cardbaobao.ts src/crawlers/index.ts public/data/sources.json
```

Expected: two new Mainland third-party parsers, parser registrations, and source registry entries.

---

### Task 7: Run Crawl and Data Validation

**Files:**
- Generated/modified: `public/data/cards/cn.json`
- Generated/modified: `public/data/cards/hk.json`
- Generated/modified: `public/data/cards/us.json`
- Generated/modified: `public/data/offers/cn.json`
- Generated/modified: `public/data/offers/hk.json`
- Generated/modified: `public/data/offers/us.json`
- Generated/modified: `public/data/metadata.json`

- [ ] **Step 1: Run the crawler**

Run:

```bash
npm run crawl
```

Expected: The command exits. Some parser failures are acceptable only if they are source-level HTTP/access failures recorded in metadata, not process-level failures. Expected success bar: existing official sources plus at least two new third-party sources succeed.

- [ ] **Step 2: Validate generated JSON**

Run:

```bash
npm run validate:data
```

Expected: `Data validation passed.`

- [ ] **Step 3: Inspect source metadata for new sources**

Run:

```bash
node -e "const m=require('./public/data/metadata.json'); for (const id of ['us-uscreditcardguide','us-doctor-of-credit','hk-moneyhero','hk-hongkongcard','cn-smzdm-credit-card','cn-cardbaobao']) console.log(id, m.sources.find(s=>s.id===id)?.status, m.sources.find(s=>s.id===id)?.itemCount, m.sources.find(s=>s.id===id)?.error || '');"
```

Expected: Each new source appears in metadata. If a source fails due to HTTP 403/404/network behavior, that source is marked `failed` with an error, while the crawl still exits successfully.

- [ ] **Step 4: Inspect generated counts**

Run:

```bash
node -e "const fs=require('fs'); for (const r of ['cn','us','hk']) { const cards=JSON.parse(fs.readFileSync(`public/data/cards/${r}.json`,'utf8')); const offers=JSON.parse(fs.readFileSync(`public/data/offers/${r}.json`,'utf8')); console.log(r, {cards: cards.length, offers: offers.length}); }"
```

Expected: Counts are nonzero for all regions. US and HK card/offer counts should increase if their aggregator pages were reachable; CN offer count should increase if SMZDM is reachable.

- [ ] **Step 5: Review checkpoint**

Review generated data changes:

```bash
git diff -- public/data/cards public/data/offers public/data/metadata.json
```

Expected: New items include Chinese display fields, original third-party text in `originalText`, valid `sourceUrl`, and correct `sourceReliability`.

---

### Task 8: Full Quality Gate

**Files:**
- All implementation and generated data files.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run TypeScript typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run ESLint**

Run:

```bash
npm run lint
```

Expected: PASS with no lint errors.

- [ ] **Step 4: Run static build**

Run:

```bash
npm run build
```

Expected: Astro builds all static pages successfully.

- [ ] **Step 5: Final review checkpoint**

Run:

```bash
git diff --stat
```

Expected: Changes are limited to crawler helpers/parsers, source registry, tests, generated JSON, and this implementation plan.

---

## Self-Review

- Spec coverage: The plan covers first-batch third-party sources for US, HK, and Mainland China, preserves static JSON generation, uses public pages only, keeps `sourceUrl`/`sourceReliability`, and keeps Chinese user-facing summaries while preserving original scraped text.
- Placeholder scan: No implementation step contains undefined placeholders. Network failures are explicitly handled by existing parser isolation rather than hidden behind unspecified fallback work.
- Type consistency: Parser modules export `SourceConfig` constants and `crawlXxx(now?: Date): Promise<CrawlResult>` functions, matching current crawler patterns. Optional schema fields are only included where values exist or are already allowed by existing code patterns.
