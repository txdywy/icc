import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import type { CrawlResult } from '../shared/types';

export const hongKongCardSource: SourceConfig = {
  id: 'hk-hongkongcard',
  region: 'HK',
  name: 'HongKongCard 信用卡比较页',
  url: 'https://www.hongkongcard.com/cards',
  reliability: 'aggregator',
};

export async function crawlHongKongCard(now = new Date()): Promise<CrawlResult> {
  return parseHongKongCardHtml(await fetchHtml(hongKongCardSource.url), now);
}

export function parseHongKongCardHtml(html: string, now: Date): CrawlResult {
  const $ = cheerio.load(html);
  const blocks = extractTextBlocks($, 'article[class*="card"], [class*="card"] a, a[href*="/cards/"]', hongKongCardSource.url);
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
    if (!seenOffers.has(parsed.offer.id)) {
      offers.push(parsed.offer);
      seenOffers.add(parsed.offer.id);
    }
  }

  return { source: hongKongCardSource, cards, offers };
}

function buildCardAndOffer(text: string, sourceUrl: string, now: Date): { card: CreditCard; offer: Offer } | undefined {
  const cardName = inferCardName(text, sourceUrl);
  if (!cardName || hasConflictingProduct(text, cardName) || !hasOfferSignal(text)) return undefined;

  const issuer = inferIssuer(text, cardName);
  if (!issuer) return undefined;

  const money = normalizeMoney(text);
  const cardId = `hk-hongkongcard-${slugify(cardName)}`;
  const estimatedValue = money?.currency === 'HKD' ? money.amount : undefined;

  const card: CreditCard = scoreCard({
    id: cardId,
    region: 'HK',
    issuer,
    name: cardName,
    welcomeOffer: {
      headline: summarizeOfferText(text),
      ...(estimatedValue !== undefined ? { estimatedValue } : {}),
      currency: 'HKD',
    },
    rewards: [{ category: 'cashback', rateText: '现金回赠比例以 HongKongCard 页面和银行官方条款为准' }],
    perks: ['迎新优惠', '现金回赠活动'],
    eligibility: 'HongKongCard 是第三方信用卡比较来源，申请资格和活动条款必须以银行官方条款为准。',
    applyUrl: sourceUrl,
    sourceUrls: [sourceUrl],
    lastCheckedAt: now.toISOString(),
  });

  const offer: Offer = scoreOffer(
    {
      id: `${cardId}-welcome`,
      region: 'HK',
      issuer,
      cardNames: [card.name],
      title: `${card.name} 第三方迎新优惠参考`,
      merchant: issuer,
      category: 'welcome',
      discountType: /mile|里數|里程/i.test(text) ? 'miles' : 'cashback',
      valueText: summarizeOfferText(text),
      ...(estimatedValue !== undefined ? { estimatedValue } : {}),
      currency: 'HKD',
      requiresRegistration: false,
      usageLimit: '新持卡人活动限制以银行官方条款为准',
      termsSummary: 'HongKongCard 是第三方信用卡比较来源，迎新优惠、资格限制和活动条款必须以银行官方条款为准。',
      originalText: safeSnippet(text, 500),
      sourceUrl,
      sourceReliability: hongKongCardSource.reliability,
      lastCheckedAt: now.toISOString(),
    },
    now,
  );

  return { card, offer };
}

function hasOfferSignal(text: string): boolean {
  return /welcome|迎新|cash ?back|cash rebate|現金回贈|现金回赠|回贈/i.test(text) && /HK\$|HKD|港元/i.test(text);
}

function inferIssuer(text: string, cardName: string): string | undefined {
  if (/citi|citibank/i.test(`${cardName} ${text}`)) return 'Citi HK';
  return undefined;
}

function hasConflictingProduct(text: string, cardName: string): boolean {
  const withoutCardName = text.replace(new RegExp(escapeRegExp(cardName), 'gi'), '');
  return /mox|asia\s*miles/i.test(withoutCardName);
}

function inferCardName(text: string, sourceUrl: string): string | undefined {
  if (/citi cash back/i.test(`${text} ${sourceUrl}`)) return 'Citi Cash Back Card';
  return undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
