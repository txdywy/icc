import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { extractCardImage } from '../shared/extractCardImage';
import { extractDateRange } from '../shared/extractDates';
import { fetchHtml } from '../shared/fetchHtml';
import { normalizeMoney } from '../shared/normalizeMoney';
import type { CrawlResult } from '../shared/types';

export const citiHkSource: SourceConfig = {
  id: 'hk-citi',
  region: 'HK',
  name: 'Citi HK 信用卡迎新优惠页',
  url: 'https://www.citibank.com.hk/english/credit-cards/',
  reliability: 'official',
};

export async function crawlCitiHk(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(citiHkSource.url);
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const money = normalizeMoney(text);
  const value = money?.currency === 'HKD' ? money.amount : 1200;
  const image = extractCardImage($, citiHkSource.url, ['Citi Cash Back Card']);

  const card: CreditCard = scoreCard({
    id: 'hk-citi-cash-back-card',
    region: 'HK',
    issuer: 'Citi HK',
    name: 'Citi Cash Back Card',
    network: ['Visa', 'Mastercard'],
    annualFee: { amount: 1800, currency: 'HKD', waiver: '年费豁免以发卡机构条款为准' },
    welcomeOffer: {
      headline: `Citi HK 公开迎新优惠，估算价值约 HK$${value.toLocaleString('en-US')}`,
      estimatedValue: value,
      currency: 'HKD',
    },
    rewards: [{ category: 'cashback', rateText: '现金回赠比例以当前公开优惠和消费类别为准', estimatedRate: 0.02 }],
    perks: ['迎新优惠', '现金回赠活动', '商户折扣'],
    eligibility: '以 Citi HK 审批结果和公开条款为准',
    ...(image ? { imageUrl: image.url, imageAlt: image.alt, imageSourceUrl: image.sourceUrl } : {}),
    applyUrl: citiHkSource.url,
    sourceUrls: [citiHkSource.url],
    lastCheckedAt: now.toISOString(),
  });

  const offer: Offer = scoreOffer(
    {
      id: 'hk-citi-welcome-cashback',
      region: 'HK',
      issuer: 'Citi HK',
      cardNames: [card.name],
      title: 'Citi HK 信用卡迎新优惠',
      merchant: 'Citi HK',
      category: 'welcome',
      ...extractDateRange(text),
      discountType: 'cashback',
      valueText: card.welcomeOffer?.headline ?? '公开迎新优惠',
      estimatedValue: value,
      currency: 'HKD',
      requiresRegistration: /register|登記|enrol/i.test(text),
      termsSummary: '迎新优惠以 Citi HK 当前公开条款为准。',
      originalText: text.slice(0, 500),
      sourceUrl: citiHkSource.url,
      sourceReliability: citiHkSource.reliability,
      lastCheckedAt: now.toISOString(),
    },
    now,
  );

  return { source: citiHkSource, cards: [card], offers: [offer] };
}

