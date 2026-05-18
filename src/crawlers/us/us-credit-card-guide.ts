import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { fetchHtml } from '../shared/fetchHtml';
import { normalizeMoney } from '../shared/normalizeMoney';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import { normalizeText, safeSnippet } from '../shared/thirdPartyExtractors';
import type { CrawlResult } from '../shared/types';

export const usCreditCardGuideSource: SourceConfig = {
  id: 'us-uscreditcardguide',
  region: 'US',
  name: '美国信用卡指南信用卡资料页',
  url: 'https://www.uscreditcardguide.com/credit-cards-en/',
  reliability: 'aggregator',
};

const pageConfigs = [
  {
    url: 'https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/',
    issuer: 'Chase',
    cardName: 'Chase Sapphire Preferred Credit Card',
  },
  {
    url: 'https://www.uscreditcardguide.com/capital-one-venture-x-credit-card/',
    issuer: 'Capital One',
    cardName: 'Capital One Venture X Credit Card',
  },
];

export async function crawlUsCreditCardGuide(now = new Date()): Promise<CrawlResult> {
  const pages = await Promise.all(pageConfigs.map(async ({ url }) => ({ url, html: await fetchHtml(url) })));
  return parseUsCreditCardGuidePages(pages, now);
}

export function parseUsCreditCardGuidePages(pages: Array<{ url: string; html: string }>, now: Date): CrawlResult {
  const cards: CreditCard[] = [];
  const offers: Offer[] = [];
  const refreshedSourceUrls = pages.map((page) => page.url);

  for (const page of pages) {
    const $ = cheerio.load(page.html);
    const title = normalizeText($('h1').first().text());
    const pageConfig = findPageConfig(page.url, title);
    const offerText = pageConfig ? extractFocusedOfferText($, pageConfig, title) : undefined;
    if (!pageConfig || !offerText) continue;

    const { issuer } = pageConfig;
    const points = extractPoints(offerText);
    const spendRequirement = extractSpendRequirement(offerText);
    const pageText = extractContentText($);
    const annualFee = extractAnnualFee(pageText) ?? normalizeMoney(pageText)?.amount;
    const discountType = /mile/i.test(offerText) ? 'miles' : 'points';
    const estimatedValue = points ? Math.round(points * (discountType === 'miles' ? 0.01 : 0.0125)) : undefined;
    const cardName = normalizeCardName(title, pageConfig);

    const card: CreditCard = scoreCard({
      id: `us-uscreditcardguide-${slugify(cardName)}`,
      region: 'US',
      issuer,
      name: cardName,
      ...(annualFee !== undefined ? { annualFee: { amount: annualFee, currency: 'USD' } } : {}),
      welcomeOffer: {
        headline: summarizeOfferText(offerText),
        ...(estimatedValue !== undefined ? { estimatedValue } : {}),
        currency: 'USD',
        ...(spendRequirement !== undefined ? { spendRequirement } : {}),
        ...(/3 months|90 days/i.test(offerText) ? { spendPeriodDays: 90 } : {}),
      },
      rewards: [],
      perks: [],
      eligibility: '第三方资料仅供参考，申请资格和活动条款必须以银行官方条款确认为准。',
      applyUrl: page.url,
      sourceUrls: [page.url],
      lastCheckedAt: now.toISOString(),
    });

    const offer: Offer = scoreOffer(
      {
        id: `${card.id}-welcome`,
        region: 'US',
        issuer,
        cardNames: [card.name],
        title: `${card.name} 第三方开卡奖励参考`,
        merchant: issuer,
        category: 'welcome',
        discountType,
        valueText: summarizeOfferText(offerText),
        ...(estimatedValue !== undefined ? { estimatedValue } : {}),
        currency: 'USD',
        ...(spendRequirement !== undefined ? { minSpend: spendRequirement } : {}),
        requiresRegistration: false,
        usageLimit: '新持卡人活动限制以银行官方条款为准',
        termsSummary: '第三方资料仅供参考，开卡奖励、资格限制和活动条款必须以银行官方条款确认为准。',
        originalText: safeSnippet(offerText, 500),
        sourceUrl: page.url,
        sourceReliability: usCreditCardGuideSource.reliability,
        lastCheckedAt: now.toISOString(),
      },
      now,
    );

    cards.push(card);
    offers.push(offer);
  }

  return { source: usCreditCardGuideSource, cards, offers, refreshedSourceUrls };
}

function extractFocusedOfferText($: cheerio.CheerioAPI, pageConfig: (typeof pageConfigs)[number], title: string): string | undefined {
  const cardTerms = pageConfig.cardName
    .replace(/ Credit Card$/i, '')
    .split(/\s+/)
    .filter((term) => !/^(credit|card)$/i.test(term));
  const blocks: string[] = [];

  $('article p, article li, article aside, main p, main li, main aside').each((_, element) => {
    const block = normalizeText($(element).text());
    if (block) blocks.push(block);
  });

  const focusedBlock = blocks.find((block) => hasWelcomeSignal(block) && hasCardIdentity(block, pageConfig, cardTerms));
  if (focusedBlock) return focusedBlock;

  if (!hasCardIdentity(title, pageConfig, cardTerms)) return undefined;
  if (blocks.some((block) => hasUnrelatedWelcomeSignal(block, pageConfig, cardTerms))) return undefined;
  return blocks.find((block) => hasWelcomeSignal(block));
}

function extractContentText($: cheerio.CheerioAPI): string {
  return normalizeText($('article, main, body').first().text());
}

function hasCardIdentity(text: string, pageConfig: (typeof pageConfigs)[number], cardTerms: string[]): boolean {
  const normalized = text.toLowerCase();
  const issuerTerms = pageConfig.issuer.toLowerCase().split(/\s+/);
  const matchedCardTerms = cardTerms.filter((term) => normalized.includes(term.toLowerCase())).length;
  return issuerTerms.every((term) => normalized.includes(term)) || matchedCardTerms >= Math.min(2, cardTerms.length);
}

function hasUnrelatedWelcomeSignal(text: string, pageConfig: (typeof pageConfigs)[number], cardTerms: string[]): boolean {
  if (!hasWelcomeSignal(text) || hasCardIdentity(text, pageConfig, cardTerms)) return false;
  const normalized = text.toLowerCase();
  const otherIssuers = pageConfigs.map((config) => config.issuer.toLowerCase()).filter((issuer) => issuer !== pageConfig.issuer.toLowerCase());
  return /asia miles/i.test(text) || otherIssuers.some((issuer) => normalized.includes(issuer));
}

function hasWelcomeSignal(text: string): boolean {
  if (/no current|not currently|no\s+[^.]{0,40}(?:welcome|bonus|offer)/i.test(text)) return false;
  return /(?:points|miles).{0,40}after|after.{0,40}(?:spend|purchase)|sign[ -]?up|welcome|bonus|offer/i.test(text);
}

function extractPoints(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(\d{4,6})\s*(?:points|miles)/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractSpendRequirement(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(?:after|spend)\s+\$?(\d+(?:\.\d+)?)\s*(?:spend|purchase)?/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractAnnualFee(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/annual fee\D{0,20}\$?(\d+(?:\.\d+)?)/i) ?? text.replace(/,/g, '').match(/\$(\d+(?:\.\d+)?)\D{0,20}annual fee/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function findPageConfig(url: string, title: string): (typeof pageConfigs)[number] | undefined {
  return pageConfigs.find((config) => normalizeUrl(config.url) === normalizeUrl(url) || title.toLowerCase().includes(config.cardName.replace(/ Credit Card$/i, '').toLowerCase()));
}

function normalizeCardName(title: string, pageConfig: (typeof pageConfigs)[number]): string {
  const cleanTitle = title
    .replace(/®/g, '')
    .replace(/\s*\([^)]*(?:Review|Update|Offer|CSP)[^)]*\)\s*/gi, ' ')
    .replace(/\s*\[[^\]]+\]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanTitle.toLowerCase().includes(pageConfig.cardName.replace(/ Credit Card$/i, '').toLowerCase())) return pageConfig.cardName;
  return pageConfig.cardName;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
