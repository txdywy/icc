import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { extractDateRange } from '../shared/extractDates';
import { fetchHtml } from '../shared/fetchHtml';
import { resolvePublicUrl } from '../shared/resolvePublicUrl';
import type { CrawlResult } from '../shared/types';

export const pinganSource: SourceConfig = {
  id: 'cn-pingan',
  region: 'CN',
  name: '平安银行信用卡活动页面',
  url: 'https://creditcard.pingan.com/',
  reliability: 'official',
};

export async function crawlPingan(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(pinganSource.url);
  const $ = cheerio.load(html);
  const offers: Offer[] = [];

  $('a, .activity, .promotion, li').each((index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (!text || !/(信用卡|活动|优惠|返现|满减|权益)/.test(text)) return;
    const href = $(element).is('a') ? $(element).attr('href') : $(element).find('a').first().attr('href');
    const sourceUrl = resolvePublicUrl(href, pinganSource.url);
    const offer = scoreOffer(
      {
        id: `cn-pingan-${index}`,
        region: 'CN',
        issuer: '平安银行',
        cardNames: ['平安信用卡'],
        title: text.slice(0, 80),
        category: /车|加油/.test(text) ? 'transport' : /餐|美食/.test(text) ? 'dining' : 'shopping',
        ...extractDateRange(text),
        discountType: /返现/.test(text) ? 'cashback' : /积分/.test(text) ? 'points' : 'instant-discount',
        valueText: text.slice(0, 120),
        currency: 'CNY',
        requiresRegistration: /报名|领取/.test(text),
        termsSummary: text.slice(0, 240),
        originalText: text,
        sourceUrl,
        sourceReliability: pinganSource.reliability,
        lastCheckedAt: now.toISOString(),
      },
      now,
    );
    offers.push(offer);
  });

  return { source: pinganSource, cards: [], offers: offers.slice(0, 20) };
}
