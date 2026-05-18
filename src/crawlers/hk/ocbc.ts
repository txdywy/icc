import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { extractDateRange } from '../shared/extractDates';
import { fetchHtml } from '../shared/fetchHtml';
import { resolvePublicUrl } from '../shared/resolvePublicUrl';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const ocbcSource: SourceConfig = {
  id: 'hk-ocbc',
  region: 'HK',
  name: 'OCBC 香港信用卡优惠页',
  url: 'https://www.ocbc.com.hk/personal-banking/cards/promotions.page',
  reliability: 'official',
};

export async function crawlOcbc(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(ocbcSource.url);
  const $ = cheerio.load(html);
  const offers: Offer[] = [];

  $('a, article, li, .promotion, .card').each((index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (!text || !/(credit card|welcome|spending|promo code|cash rebate|信用卡|迎新|簽賬)/i.test(text)) return;
    const href = $(element).is('a') ? $(element).attr('href') : $(element).find('a').first().attr('href');
    const sourceUrl = resolvePublicUrl(href, ocbcSource.url);
    const summary = summarizeOfferText(text);
    offers.push(
      scoreOffer(
        {
          id: `hk-ocbc-${index}`,
          region: 'HK',
          issuer: 'OCBC HK',
          title: summary,
          category: /welcome|迎新/i.test(text) ? 'welcome' : /travel|hotel/i.test(text) ? 'travel' : 'shopping',
          ...extractDateRange(text),
          discountType: /rebate|cashback|回贈/i.test(text) ? 'cashback' : /promo code|code|優惠碼/i.test(text) ? 'coupon' : 'other',
          valueText: summary,
          currency: 'HKD',
          quotaText: /quota|limited|名額/i.test(text) ? '名额可能有限，需以 OCBC 公开条款为准' : undefined,
          requiresRegistration: /promo code|code|register|登記|優惠碼/i.test(text),
          termsSummary: `${summary}，具体资格、名额和日期以 OCBC 公开条款为准。`,
          originalText: text,
          sourceUrl,
          sourceReliability: ocbcSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  });

  return { source: ocbcSource, cards: [], offers: offers.slice(0, 20) };
}
