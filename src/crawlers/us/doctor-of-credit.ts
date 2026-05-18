import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import { extractTextBlocks, safeSnippet } from '../shared/thirdPartyExtractors';
import type { CrawlResult } from '../shared/types';

export const doctorOfCreditSource: SourceConfig = {
  id: 'us-doctor-of-credit',
  region: 'US',
  name: 'Doctor of Credit 当前开卡奖励汇总',
  url: 'https://www.doctorofcredit.com/best-current-credit-card-sign-bonuses/',
  reliability: 'aggregator',
};

export async function crawlDoctorOfCredit(now = new Date()): Promise<CrawlResult> {
  return parseDoctorOfCreditHtml(await fetchHtml(doctorOfCreditSource.url), now);
}

export function parseDoctorOfCreditHtml(html: string, now: Date): CrawlResult {
  const $ = cheerio.load(html);
  $('#comments, .comments-area, .comment-list, .comment-respond').remove();

  const offers = extractTextBlocks($, 'article li, main li, article p, main p', doctorOfCreditSource.url)
    .filter((block) => hasWelcomeSignal(block.text))
    .flatMap((block) => buildOffer(block.text, block.sourceUrl, now));

  return { source: doctorOfCreditSource, cards: [], offers };
}

function buildOffer(text: string, sourceUrl: string, now: Date): Offer[] {
  const issuer = inferIssuer(text);
  const cardName = inferCardName(text);
  if (!issuer || !cardName) return [];

  const points = extractPoints(text);
  const spendRequirement = extractSpendRequirement(text);
  const discountType = /mile/i.test(text) ? 'miles' : 'points';
  const estimatedValue = points ? Math.round(points * (discountType === 'miles' ? 0.01 : 0.0125)) : undefined;

  return [
    scoreOffer(
    {
      id: `us-doctor-of-credit-${slugify(cardName)}-welcome`,
      region: 'US',
      issuer,
      ...(cardName ? { cardNames: [cardName] } : {}),
      title: `${cardName || issuer} 第三方开卡奖励参考`,
      merchant: issuer,
      category: 'welcome',
      discountType,
      valueText: summarizeOfferText(text),
      ...(estimatedValue !== undefined ? { estimatedValue } : {}),
      currency: 'USD',
      ...(spendRequirement !== undefined ? { minSpend: spendRequirement } : {}),
      requiresRegistration: false,
      usageLimit: '新持卡人活动限制以银行官方条款为准',
      termsSummary: 'Doctor of Credit 为第三方汇总，开卡奖励、资格限制和活动条款必须以银行官方条款确认为准。',
      originalText: safeSnippet(text, 500),
      sourceUrl,
      sourceReliability: doctorOfCreditSource.reliability,
      lastCheckedAt: now.toISOString(),
    },
    now,
  ),
  ];
}

function hasWelcomeSignal(text: string): boolean {
  return /(?:points|miles).{0,40}after|after.{0,40}(?:spend|purchase)|sign[ -]?up|welcome|bonus/i.test(text);
}

function extractPoints(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(\d{4,6})\s*(?:points|miles)/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractSpendRequirement(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(?:after|spend)\s+\$?(\d+(?:\.\d+)?)\s*(?:spend|purchase)?/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function inferIssuer(text: string): string | undefined {
  if (/capital one/i.test(text)) return 'Capital One';
  if (/american express|\bamex\b/i.test(text)) return 'American Express';
  if (/citi/i.test(text)) return 'Citi';
  if (/chase/i.test(text)) return 'Chase';
  return undefined;
}

function inferCardName(text: string): string | undefined {
  const knownCards = [
    'Chase Sapphire Preferred',
    'Capital One Venture X',
    'American Express Gold',
    'American Express Platinum',
    'Citi Strata Premier',
  ];
  return knownCards.find((name) => text.toLowerCase().includes(name.toLowerCase()));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
