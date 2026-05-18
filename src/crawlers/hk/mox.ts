import * as cheerio from 'cheerio';
import { scoreOffer } from '../../lib/scoring';
import type { Offer, SourceConfig } from '../../lib/schema';
import { extractDateRange } from '../shared/extractDates';
import { fetchHtml } from '../shared/fetchHtml';
import { resolvePublicUrl } from '../shared/resolvePublicUrl';
import { summarizeOfferText } from '../shared/summarizeOfferText';
import type { CrawlResult } from '../shared/types';

export const moxSource: SourceConfig = {
  id: 'hk-mox',
  region: 'HK',
  name: 'Mox 信用卡优惠页',
  url: 'https://mox.com/promotions/',
  reliability: 'official',
};

export async function crawlMox(now = new Date()): Promise<CrawlResult> {
  const html = await fetchHtml(moxSource.url);
  const $ = cheerio.load(html);
  const offers: Offer[] = [];

  $('a, article, li, .promotion').each((index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (!text || !/(Mox Credit|Asia Miles|cashback|welcome|promotion|迎新|里數)/i.test(text)) return;
    const href = $(element).is('a') ? $(element).attr('href') : $(element).find('a').first().attr('href');
    const sourceUrl = resolvePublicUrl(href, moxSource.url);
    const summary = summarizeOfferText(text);
    offers.push(
      scoreOffer(
        {
          id: `hk-mox-${index}`,
          region: 'HK',
          issuer: 'Mox Bank',
          cardNames: ['Mox Credit'],
          title: summary,
          category: /Asia Miles|里數/i.test(text) ? 'travel' : /welcome|迎新/i.test(text) ? 'welcome' : 'shopping',
          ...extractDateRange(text),
          discountType: /miles|里數/i.test(text) ? 'miles' : /cashback|回贈/i.test(text) ? 'cashback' : 'other',
          valueText: summary,
          currency: 'HKD',
          requiresRegistration: /register|登記|join/i.test(text),
          termsSummary: `${summary}，具体资格、名额和日期以 Mox 公开条款为准。`,
          originalText: text,
          sourceUrl,
          sourceReliability: moxSource.reliability,
          lastCheckedAt: now.toISOString(),
        },
        now,
      ),
    );
  });

  return { source: moxSource, cards: [], offers: offers.slice(0, 20) };
}
