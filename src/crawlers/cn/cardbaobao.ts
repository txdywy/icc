import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import type { CrawlResult } from '../shared/types';

export const cardbaobaoSource: SourceConfig = {
  id: 'cn-cardbaobao',
  region: 'CN',
  name: '卡宝宝信用卡中心',
  url: 'https://www.cardbaobao.com/card/',
  reliability: 'aggregator',
};

export async function crawlCardbaobao(now = new Date()): Promise<CrawlResult> {
  return parseCardbaobaoHtml(await fetchHtml(cardbaobaoSource.url), now);
}

export function parseCardbaobaoHtml(html: string, now: Date): CrawlResult {
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'article, section, li, div, a', cardbaobaoSource.url, 12);
  const cards: CreditCard[] = [];
  const offers: Offer[] = [];
  const seenCards = new Set<string>();
  const seenOffers = new Set<string>();

  for (const block of blocks) {
    const parsed = buildCardAndOffer(block.text, block.sourceUrl, now);
    if (!parsed) continue;

    if (!seenCards.has(parsed.card.id)) {
      cards.push(parsed.card);
      seenCards.add(parsed.card.id);
    }
    if (parsed.offer && !seenOffers.has(parsed.offer.id)) {
      offers.push(parsed.offer);
      seenOffers.add(parsed.offer.id);
    }
  }

  return { source: cardbaobaoSource, cards, offers };
}

function buildCardAndOffer(text: string, sourceUrl: string, now: Date): { card: CreditCard; offer?: Offer } | undefined {
  const issuer = inferIssuer(text);
  const cardName = inferCardName(text, issuer);
  if (!issuer || !cardName) return undefined;

  const money = normalizeMoney(text);
  const annualFee = extractAnnualFee(text) ?? (/年费/.test(text) ? money?.amount : undefined);
  const cardId = `cn-cardbaobao-${slugify(cardName)}`;
  const hasOffer = /新户|迎新|优惠|首刷|返现|积分|权益/.test(text);

  const card: CreditCard = scoreCard({
    id: cardId,
    region: 'CN',
    issuer,
    name: cardName,
    ...(annualFee !== undefined ? { annualFee: { amount: annualFee, currency: 'CNY' } } : {}),
    ...(hasOffer
      ? {
          welcomeOffer: {
            headline: summarizeOfferText(text),
            currency: 'CNY',
          },
        }
      : {}),
    rewards: /积分/.test(text) ? [{ category: 'points', rateText: '积分权益以卡宝宝页面和银行官方条款为准' }] : [],
    perks: inferPerks(text),
    eligibility: '卡宝宝是第三方信用卡聚合平台，申请资格、年费权益和活动条款必须以银行官方条款为准。',
    applyUrl: sourceUrl,
    sourceUrls: [sourceUrl],
    lastCheckedAt: now.toISOString(),
  });

  const offer = hasOffer
    ? scoreOffer(
        {
          id: `${cardId}-offer`,
          region: 'CN',
          issuer,
          cardNames: [card.name],
          title: `${card.name} 第三方优惠参考`,
          merchant: issuer,
          category: /新户|迎新|首刷/.test(text) ? 'welcome' : 'shopping',
          discountType: /积分/.test(text) ? 'points' : /返现|现金/.test(text) ? 'cashback' : 'instant-discount',
          valueText: summarizeOfferText(text),
          currency: 'CNY',
          requiresRegistration: false,
          usageLimit: '新户和活动限制以银行官方条款为准',
          termsSummary: '卡宝宝是第三方聚合来源，信用卡权益、优惠资格和活动条款必须以银行官方条款确认为准。',
          originalText: safeSnippet(text, 500),
          sourceUrl,
          sourceReliability: cardbaobaoSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      )
    : undefined;

  return { card, ...(offer ? { offer } : {}) };
}

function inferIssuer(text: string): string | undefined {
  if (/招商银行|招商|招行|CMB/i.test(text)) return '招商银行';
  if (/民生/.test(text)) return '民生银行';
  if (/平安/.test(text)) return '平安银行';
  if (/中信/.test(text)) return '中信银行';
  if (/银联/.test(text)) return '银联';
  return undefined;
}

function inferCardName(text: string, issuer: string | undefined): string | undefined {
  if (!issuer || !/信用卡/.test(text)) return undefined;

  const match = text.match(/(?:招商银行|招商|招行|民生银行|民生|平安银行|平安|中信银行|中信|银联)?\s*([一-龥A-Za-z0-9·\- ]{2,40}?信用卡)/);
  const name = match?.[1]?.replace(/^(银行|信用卡中心)/, '').trim();
  if (!name) return undefined;
  return name.includes(issuer) ? name : name.replace(new RegExp(`^${issuer}`), '').trim();
}

function inferPerks(text: string): string[] {
  const perks: string[] = [];
  if (/积分/.test(text)) perks.push('积分权益');
  if (/新户|迎新/.test(text)) perks.push('新户优惠');
  if (/年费/.test(text)) perks.push('年费规则以官方条款为准');
  return perks;
}

function extractAnnualFee(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/年费\D{0,20}(?:¥|￥|CNY|RMB)?\s*(\d+(?:\.\d+)?)/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}
