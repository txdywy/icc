import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import type { CrawlResult } from '../shared/types';

export const smzdmSource: SourceConfig = {
  id: 'cn-smzdm-credit-card',
  region: 'CN',
  name: '什么值得买信用卡频道',
  url: 'https://www.smzdm.com/zy/category/av6ko9y/',
  reliability: 'community',
};

export async function crawlSmzdm(now = new Date()): Promise<CrawlResult> {
  return parseSmzdmHtml(await fetchHtml(smzdmSource.url), now);
}

export function parseSmzdmHtml(html: string, now: Date): CrawlResult {
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'article, section, li, div, a', smzdmSource.url, 12);
  const offers: Offer[] = [];
  const seenOffers = new Set<string>();

  for (const block of blocks) {
    const offer = buildOffer(block.text, block.sourceUrl, now);
    if (!offer || seenOffers.has(offer.id)) continue;

    offers.push(offer);
    seenOffers.add(offer.id);
  }

  return { source: smzdmSource, cards: [], offers };
}

function buildOffer(text: string, sourceUrl: string, now: Date): Offer | undefined {
  if (!hasCreditCardOfferSignal(text)) return undefined;

  const issuer = inferIssuer(text);
  if (!issuer) return undefined;

  const money = normalizeMoney(text);
  const discountValue = extractDiscountValue(text, money?.amount);
  const minSpend = extractMinSpend(text);
  const title = safeSnippet(text, 80);

  return scoreOffer(
    {
      id: `cn-smzdm-${slugify(`${issuer}-${title}`)}`,
      region: 'CN',
      issuer,
      cardNames: [`${issuer}信用卡`],
      title,
      category: inferCategory(text),
      discountType: inferDiscountType(text),
      valueText: summarizeOfferText(text),
      ...(discountValue !== undefined ? { estimatedValue: discountValue, maxDiscount: discountValue } : {}),
      currency: money?.currency ?? 'CNY',
      ...(minSpend !== undefined ? { minSpend } : {}),
      requiresRegistration: /报名|领取|注册/.test(text),
      termsSummary: '什么值得买内容属于社区或编辑线索，优惠资格、名额和条款必须以官方银行或商户规则确认为准。',
      originalText: safeSnippet(text, 500),
      sourceUrl,
      sourceReliability: smzdmSource.reliability,
      lastCheckedAt: now.toISOString(),
    },
    now,
  );
}

function hasCreditCardOfferSignal(text: string): boolean {
  return /信用卡|银行卡|银联|云闪付/.test(text) && /活动|优惠|返现|满\s*\d+\s*减|立减|权益|报名/.test(text);
}

function inferIssuer(text: string): string | undefined {
  if (/银联|云闪付/.test(text)) return '银联';
  if (/招商|招行|CMB/i.test(text)) return '招商银行';
  if (/民生/.test(text)) return '民生银行';
  if (/平安/.test(text)) return '平安银行';
  if (/中信/.test(text)) return '中信银行';
  return undefined;
}

function inferCategory(text: string): Offer['category'] {
  if (/餐|美食|饮|饭|咖啡/.test(text)) return 'dining';
  if (/酒店|住宿/.test(text)) return 'hotel';
  if (/机票|旅游|旅行|里程/.test(text)) return 'travel';
  if (/地铁|公交|出行|交通/.test(text)) return 'transport';
  if (/支付|微信|支付宝|云闪付/.test(text)) return 'mobile-payment';
  if (/分期/.test(text)) return 'installment';
  if (/境外|海外/.test(text)) return 'overseas';
  return 'shopping';
}

function inferDiscountType(text: string): Offer['discountType'] {
  if (/返现|返还|立返|现金/.test(text)) return 'cashback';
  if (/积分/.test(text)) return 'points';
  if (/券|优惠券/.test(text)) return 'coupon';
  if (/分期/.test(text)) return 'installment-discount';
  return 'instant-discount';
}

function extractMinSpend(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/满\s*(\d+(?:\.\d+)?)/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractDiscountValue(text: string, firstAmount: number | undefined): number | undefined {
  const match = text.replace(/,/g, '').match(/(?:减|返|省|返现)\s*(\d+(?:\.\d+)?)/);
  return match?.[1] ? Number(match[1]) : firstAmount;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
