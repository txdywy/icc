import * as cheerio from 'cheerio';
import { scoreCard, scoreOffer } from '../../lib/scoring';
import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';
import { extractCardImage } from '../shared/extractCardImage';
import { extractDateRange } from '../shared/extractDates';
import { fetchHtml } from '../shared/fetchHtml';
import { normalizeMoney } from '../shared/normalizeMoney';
import { resolvePublicUrl } from '../shared/resolvePublicUrl';
import type { CrawlResult } from '../shared/types';

export const cmbcSource: SourceConfig = {
  id: 'cn-cmbc',
  region: 'CN',
  name: '民生信用卡官网活动公告',
  url: 'https://creditcard.cmbc.com.cn/',
  reliability: 'official',
};

export async function crawlCmbc(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(cmbcSource.url);
  const $ = cheerio.load(html);
  const offers: Offer[] = [];
  const image = extractCardImage($, cmbcSource.url, ['民生信用卡']);
  const card: CreditCard = scoreCard({
    id: 'cn-cmbc-standard',
    region: 'CN',
    issuer: '民生银行',
    name: '民生信用卡',
    network: ['UnionPay', 'Visa', 'Mastercard'],
    annualFee: { amount: 0, currency: 'CNY', waiver: '以卡种官方规则为准' },
    welcomeOffer: {
      headline: '新户礼以民生信用卡官网最新活动为准',
      estimatedValue: 100,
      currency: 'CNY',
    },
    rewards: [{ category: 'daily', rateText: '消费积分及商户活动以官方公告为准', estimatedRate: 0.01 }],
    perks: ['官方活动覆盖餐饮、购物、移动支付等场景', '部分活动可能需报名或限量'],
    eligibility: '以银行审批与活动条款为准',
    ...(image ? { imageUrl: image.url, imageAlt: image.alt, imageSourceUrl: image.sourceUrl } : {}),
    applyUrl: cmbcSource.url,
    sourceUrls: [cmbcSource.url],
    lastCheckedAt: now.toISOString(),
  });

  $('a').each((index, element) => {
    const title = $(element).text().replace(/\s+/g, ' ').trim();
    const href = $(element).attr('href');
    if (!title || !/(活动|优惠|满|减|返|券)/.test(title)) return;

    const sourceUrl = resolvePublicUrl(href, cmbcSource.url);
    const context = $(element).parent().text().replace(/\s+/g, ' ').trim() || title;
    const dates = extractDateRange(context);
    const money = normalizeMoney(context);
    const offer = scoreOffer(
      {
        id: `cn-cmbc-${index}`,
        region: 'CN',
        issuer: '民生银行',
        cardNames: ['民生信用卡'],
        title,
        category: inferCategory(context),
        ...dates,
        discountType: inferDiscountType(context),
        valueText: money ? `${money.currency} ${money.amount}` : title,
        estimatedValue: inferDiscountValue(context, money?.amount),
        currency: money?.currency ?? 'CNY',
        minSpend: inferMinSpend(context),
        maxDiscount: inferDiscountValue(context, money?.amount),
        quotaText: /(名额|限量|先到先得)/.test(context) ? context : undefined,
        requiresRegistration: /报名|领取|注册/.test(context),
        termsSummary: context.slice(0, 240),
        originalText: context,
        sourceUrl,
        sourceReliability: cmbcSource.reliability,
        lastCheckedAt: now.toISOString(),
      },
      now,
    );
    offers.push(offer);
  });

  return { source: cmbcSource, cards: [card], offers: offers.slice(0, 20) };
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
  if (/返现|返还|立返/.test(text)) return 'cashback';
  if (/积分/.test(text)) return 'points';
  if (/券|优惠券/.test(text)) return 'coupon';
  if (/分期/.test(text)) return 'installment-discount';
  return 'instant-discount';
}

function inferMinSpend(text: string): number | undefined {
  const match = text.replace(/,/g, '').match(/满\s*(\d+(?:\.\d+)?)/);
  return match?.[1] ? Number(match[1]) : undefined;
}

function inferDiscountValue(text: string, firstAmount: number | undefined): number | undefined {
  const match = text.replace(/,/g, '').match(/(?:减|返|省)\s*(\d+(?:\.\d+)?)/);
  return match?.[1] ? Number(match[1]) : firstAmount;
}
