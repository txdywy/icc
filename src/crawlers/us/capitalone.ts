import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { extractCardImage } from '../shared/extractCardImage';
import { fetchHtml } from '../shared/fetchHtml';
import { summarizeWelcomeOffer } from '../shared/summarizeWelcomeOffer';
import type { CrawlResult } from '../shared/types';

export const capitalOneSource: SourceConfig = {
  id: 'us-capital-one-venture-x',
  region: 'US',
  name: 'Capital One Venture X 官方页',
  url: 'https://www.capitalone.com/credit-cards/venture-x/',
  reliability: 'official',
};

export async function crawlCapitalOne(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(capitalOneSource.url);
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const welcomeValue = extractMilesValue(text) ?? 750;
  const spendRequirement = extractSpendRequirement(text) ?? 4000;
  const annualFee = extractAnnualFee(text) ?? 395;
  const image = extractCardImage($, capitalOneSource.url, ['Capital One Venture X Rewards Credit Card', 'Venture X']);

  const card: CreditCard = scoreCard({
    id: 'us-capital-one-venture-x',
    region: 'US',
    issuer: 'Capital One',
    name: 'Capital One Venture X Rewards Credit Card',
    network: ['Visa'],
    annualFee: { amount: annualFee, currency: 'USD' },
    welcomeOffer: {
      headline: summarizeWelcomeOffer('Capital One', welcomeValue, spendRequirement),
      estimatedValue: welcomeValue,
      currency: 'USD',
      spendRequirement,
      spendPeriodDays: /3 months|90 days/i.test(text) ? 90 : undefined,
    },
    rewards: [
      { category: 'travel', rateText: '通过 Capital One Travel 预订旅行可获得更高里程倍率', estimatedRate: 0.1 },
      { category: 'daily', rateText: '日常消费每 1 美元可累积 2 倍里程', estimatedRate: 0.02 },
    ],
    perks: ['年度旅行报销', '周年里程奖励', 'Global Entry 或 TSA PreCheck 报销', '机场贵宾室权益'],
    eligibility: '以 Capital One 审批结果和公开活动条款为准',
    ...(image ? { imageUrl: image.url, imageAlt: image.alt, imageSourceUrl: image.sourceUrl } : {}),
    applyUrl: capitalOneSource.url,
    sourceUrls: [capitalOneSource.url],
    lastCheckedAt: now.toISOString(),
  });

  const offer: Offer = scoreOffer(
    {
      id: 'us-capital-one-venture-x-welcome',
      region: 'US',
      issuer: 'Capital One',
      cardNames: [card.name],
      title: 'Capital One Venture X 公开开卡奖励',
      merchant: 'Capital One',
      category: 'welcome',
      discountType: 'miles',
      valueText: card.welcomeOffer?.headline ?? '公开开卡奖励',
      estimatedValue: welcomeValue,
      currency: 'USD',
      minSpend: spendRequirement,
      requiresRegistration: false,
      usageLimit: '新持卡人活动条款适用',
      termsSummary: '资格和里程价值以 Capital One 公开条款为准。',
      originalText: text.slice(0, 500),
      sourceUrl: capitalOneSource.url,
      sourceReliability: capitalOneSource.reliability,
      lastCheckedAt: now.toISOString(),
    },
    now,
  );

  return { source: capitalOneSource, cards: [card], offers: [offer] };
}

function extractMilesValue(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(\d{4,6})\s+(?:bonus\s+)?miles/i);
  return match?.[1] ? Math.round(Number(match[1]) * 0.01) : undefined;
}

function extractSpendRequirement(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/spend\s+\$?(\d+(?:\.\d+)?)/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractAnnualFee(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/\$(\d+)\s+annual fee/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

