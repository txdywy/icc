import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { extractDateRange } from '../shared/extractDates';
import { fetchHtml } from '../shared/fetchHtml';
import { resolvePublicUrl } from '../shared/resolvePublicUrl';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const hangSengSource: SourceConfig = {
  id: 'hk-hangseng',
  region: 'HK',
  name: '恒生信用卡全年优惠页',
  url: 'https://www.hangseng.com/en-hk/personal/cards/offers/',
  reliability: 'official',
};

export async function crawlHangSeng(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(hangSengSource.url);
  const $ = cheerio.load(html);
  const offers: Offer[] = [];

  $('a, article, li, .card').each((index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (!text || !/(offer|discount|cashback|rebate|year-round|優惠|折扣)/i.test(text)) return;
    const href = $(element).is('a') ? $(element).attr('href') : $(element).find('a').first().attr('href');
    const sourceUrl = resolvePublicUrl(href, hangSengSource.url);
    const summary = summarizeOfferText(text);
    offers.push(
      scoreOffer(
        {
          id: `hk-hangseng-${index}`,
          region: 'HK',
          issuer: 'Hang Seng',
          title: summary,
          category: inferCategory(text),
          ...extractDateRange(text),
          discountType: /cashback|rebate/i.test(text) ? 'cashback' : /coupon|voucher/i.test(text) ? 'coupon' : 'instant-discount',
          valueText: summary,
          currency: 'HKD',
          requiresRegistration: /register|enrol|登記/i.test(text),
          termsSummary: `${summary}，具体资格、名额和日期以恒生公开条款为准。`,
          originalText: text,
          sourceUrl,
          sourceReliability: hangSengSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  });

  return { source: hangSengSource, cards: [], offers: offers.slice(0, 20) };
}

function inferCategory(text: string): Offer['category'] {
  if (/dining|restaurant|餐/i.test(text)) return 'dining';
  if (/travel|flight|hotel|旅|酒店/i.test(text)) return 'travel';
  if (/grocery|supermarket|超市/i.test(text)) return 'grocery';
  if (/transport|taxi|mtr|交通/i.test(text)) return 'transport';
  return 'shopping';
}
