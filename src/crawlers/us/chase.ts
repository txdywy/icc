import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { extractCardImage } from '../shared/extractCardImage';
import { fetchHtml } from '../shared/fetchHtml';
import { summarizeWelcomeOffer } from '../shared/summarizeWelcomeOffer';
import { normalizeMoney } from '../shared/normalizeMoney';
import type { CrawlResult } from '../shared/types';

export const chaseSource: SourceConfig = {
  id: 'us-chase-sapphire-preferred',
  region: 'US',
  name: 'Chase Sapphire Preferred 官方页',
  url: 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred',
  reliability: 'official',
};

export async function crawlChase(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(chaseSource.url);
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const welcomeValue = extractPointsValue(text) ?? normalizeMoney(text)?.amount;
  const spendRequirement = extractSpendRequirement(text);
  const annualFee = extractAnnualFee(text) ?? 95;
  const image = extractCardImage($, chaseSource.url, ['Chase Sapphire Preferred']);

  const card: CreditCard = scoreCard({
    id: 'us-chase-sapphire-preferred',
    region: 'US',
    issuer: 'Chase',
    name: 'Chase Sapphire Preferred',
    network: ['Visa'],
    annualFee: { amount: annualFee, currency: 'USD' },
    welcomeOffer: {
      headline: summarizeWelcomeOffer('Chase', welcomeValue, spendRequirement),
      estimatedValue: welcomeValue,
      currency: 'USD',
      spendRequirement,
      spendPeriodDays: /3 months|90 days/i.test(text) ? 90 : undefined,
    },
    rewards: [
      { category: 'travel', rateText: '通过 Chase Travel 等指定渠道可获得更高积分倍率', estimatedRate: 0.05 },
      { category: 'dining', rateText: '餐饮消费可获得较高积分倍率，具体以 Chase 公开条款为准', estimatedRate: 0.03 },
    ],
    perks: ['积分转点伙伴', '旅行保障', '酒店抵扣以当前条款为准'].filter(Boolean),
    eligibility: '以 Chase 审批结果和公开活动条款为准',
    ...(image ? { imageUrl: image.url, imageAlt: image.alt, imageSourceUrl: image.sourceUrl } : {}),
    applyUrl: chaseSource.url,
    sourceUrls: [chaseSource.url],
    lastCheckedAt: now.toISOString(),
  });

  const offer: Offer = scoreOffer(
    {
      id: 'us-chase-sapphire-preferred-welcome',
      region: 'US',
      issuer: 'Chase',
      cardNames: [card.name],
      title: 'Chase Sapphire Preferred 公开开卡奖励',
      merchant: 'Chase',
      category: 'welcome',
      discountType: 'points',
      valueText: card.welcomeOffer?.headline ?? '公开开卡奖励',
      estimatedValue: welcomeValue,
      currency: 'USD',
      minSpend: spendRequirement,
      requiresRegistration: false,
      usageLimit: '新持卡人活动条款适用',
      termsSummary: '资格和积分价值以 Chase 公开条款为准。',
      originalText: text.slice(0, 500),
      sourceUrl: chaseSource.url,
      sourceReliability: chaseSource.reliability,
      lastCheckedAt: now.toISOString(),
    },
    now,
  );

  return { source: chaseSource, cards: [card], offers: [offer] };
}

function extractPointsValue(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/(\d{4,6})\s+(?:bonus\s+)?points/i);
  return match?.[1] ? Math.round(Number(match[1]) * 0.0125) : undefined;
}

function extractSpendRequirement(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/spend\s+\$?(\d+(?:\.\d+)?)/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

function extractAnnualFee(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/\$(\d+)\s+annual fee/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

