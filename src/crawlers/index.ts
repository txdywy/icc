import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { cardbaobaoSource, crawlCardbaobao } from './cn/cardbaobao';
import { cmbcSource, crawlCmbc } from './cn/cmbc';
import { cmbSource, crawlCmb } from './cn/cmb';
import { citicSource, crawlCitic } from './cn/citic';
import { crawlPingan, pinganSource } from './cn/pingan';
import { crawlSmzdm, smzdmSource } from './cn/smzdm';
import { crawlUnionPay, unionpaySource } from './cn/unionpay';
import { amexSource, crawlAmex } from './us/amex';
import { capitalOneSource, crawlCapitalOne } from './us/capitalone';
import { chaseSource, crawlChase } from './us/chase';
import { citiSource, crawlCiti } from './us/citi';
import { crawlDoctorOfCredit, doctorOfCreditSource } from './us/doctor-of-credit';
import { crawlUsCreditCardGuide, usCreditCardGuideSource } from './us/us-credit-card-guide';
import { citiHkSource, crawlCitiHk } from './hk/citi-hk';
import { crawlHangSeng, hangSengSource } from './hk/hangseng';
import { crawlHongKongCard, hongKongCardSource } from './hk/hongkongcard';
import { crawlMoneyHero, moneyHeroSource } from './hk/moneyhero';
import { crawlMox, moxSource } from './hk/mox';
import { crawlOcbc, ocbcSource } from './hk/ocbc';
import { dedupeOffers } from './shared/dedupe';
import { filterStaleSeedCards } from './shared/filterSeedCards';
import { filterStaleSeedOffers } from './shared/filterSeedOffers';
import { logError, logInfo } from './shared/logger';
import type { CrawlResult, SourceParser } from './shared/types';
import { scoreCard, scoreOffer } from '../lib/scoring';
import {
  creditCardSchema,
  metadataSchema,
  offerSchema,
  type CreditCard,
  type Metadata,
  type Offer,
  type Region,
  type SourceStatus,
} from '../lib/schema';

const parserJobs: { parser: SourceParser; source: CrawlResult['source'] }[] = [
  { parser: crawlCmbc, source: cmbcSource },
  { parser: crawlPingan, source: pinganSource },
  { parser: crawlUnionPay, source: unionpaySource },
  { parser: crawlCitic, source: citicSource },
  { parser: crawlCmb, source: cmbSource },
  { parser: crawlCardbaobao, source: cardbaobaoSource },
  { parser: crawlSmzdm, source: smzdmSource },
  { parser: crawlChase, source: chaseSource },
  { parser: crawlCapitalOne, source: capitalOneSource },
  { parser: crawlAmex, source: amexSource },
  { parser: crawlCiti, source: citiSource },
  { parser: crawlUsCreditCardGuide, source: usCreditCardGuideSource },
  { parser: crawlDoctorOfCredit, source: doctorOfCreditSource },
  { parser: crawlHangSeng, source: hangSengSource },
  { parser: crawlCitiHk, source: citiHkSource },
  { parser: crawlMox, source: moxSource },
  { parser: crawlOcbc, source: ocbcSource },
  { parser: crawlMoneyHero, source: moneyHeroSource },
  { parser: crawlHongKongCard, source: hongKongCardSource },
];

const dataDir = join(process.cwd(), 'public', 'data');
const regions: Region[] = ['CN', 'US', 'HK'];

async function main(): Promise<void> {
  const now = new Date();
  const seedCards = await readRegionFiles('cards', creditCardSchema);
  const seedOffers = await readRegionFiles('offers', offerSchema);
  const settled = await Promise.all(parserJobs.map((job) => runParser(job, now)));
  const successes = settled.flatMap((result) => (result.result ? [result.result] : []));
  const sources = settled.map((result) => result.status);
  const crawledCards = successes.flatMap((result) => result.cards);
  const refreshedCardSources = [
    ...successes.map((result) => result.source.url),
    ...successes.flatMap((result) => result.refreshedSourceUrls ?? []),
    ...crawledCards.flatMap((card) => card.sourceUrls),
  ];
  const cards = mergeCards(filterStaleSeedCards(seedCards, refreshedCardSources), crawledCards, now);
  const crawledOffers = successes.flatMap((result) => result.offers);
  const refreshedOfferSources = successes.filter((result) => result.offers.length > 0).map((result) => result.source.url);
  const refreshedOfferIssuers = [...new Set(crawledOffers.map((offer) => offer.issuer))];
  const offers = mergeOffers(filterStaleSeedOffers(seedOffers, refreshedOfferSources, refreshedOfferIssuers), crawledOffers, now);

  await writeRegionFiles('cards', cards, creditCardSchema);
  await writeRegionFiles('offers', offers, offerSchema);

  const metadata: Metadata = metadataSchema.parse({
    lastUpdatedAt: now.toISOString(),
    totalCards: cards.length,
    totalOffers: offers.length,
    sources,
  });

  await writeFile(join(dataDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  logInfo(`Crawl complete: ${cards.length} cards, ${offers.length} offers, ${sources.length} sources.`);
}

async function runParser(
  job: { parser: SourceParser; source: CrawlResult['source'] },
  now: Date,
): Promise<{ result?: CrawlResult; status: SourceStatus }> {
  try {
    const result = await job.parser();
    const itemCount = result.cards.length + result.offers.length;
    return {
      result,
      status: {
        id: result.source.id,
        region: result.source.region,
        name: result.source.name,
        url: result.source.url,
        status: 'success',
        lastCheckedAt: now.toISOString(),
        itemCount,
      },
    };
  } catch (error: unknown) {
    logError(`Parser failed for ${job.source.name}`, error);
    return {
      status: {
        id: job.source.id,
        region: job.source.region,
        name: job.source.name,
        url: job.source.url,
        status: 'failed',
        lastCheckedAt: now.toISOString(),
        error: error instanceof Error ? error.message : String(error),
        itemCount: 0,
      },
    };
  }
}

function mergeCards(seedCards: CreditCard[], crawledCards: CreditCard[], now: Date): CreditCard[] {
  const map = new Map<string, CreditCard>();
  for (const card of seedCards) map.set(card.id, scoreCard(card));
  for (const card of crawledCards) map.set(card.id, scoreCard({ ...card, lastCheckedAt: now.toISOString() }));
  return [...map.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function mergeOffers(seedOffers: Offer[], crawledOffers: Offer[], now: Date): Offer[] {
  const scored = [...seedOffers, ...crawledOffers].map((offer) => scoreOffer({ ...offer, lastCheckedAt: offer.lastCheckedAt || now.toISOString() }, now));
  return dedupeOffers(scored).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

async function readRegionFiles<T extends z.ZodTypeAny>(folder: 'cards' | 'offers', schema: T): Promise<z.infer<T>[]> {
  const items: z.infer<T>[] = [];
  for (const region of regions) {
    const path = join(dataDir, folder, `${region.toLowerCase()}.json`);
    const parsed = z.array(schema).parse(JSON.parse(await readFile(path, 'utf8')));
    items.push(...parsed);
  }
  return items;
}

async function writeRegionFiles<T extends z.ZodTypeAny>(folder: 'cards' | 'offers', items: z.infer<T>[], schema: T): Promise<void> {
  await mkdir(join(dataDir, folder), { recursive: true });
  for (const region of regions) {
    const regionItems = items.filter((item: { region: Region }) => item.region === region);
    const parsed = z.array(schema).parse(regionItems);
    await writeFile(join(dataDir, folder, `${region.toLowerCase()}.json`), `${JSON.stringify(parsed, null, 2)}\n`);
  }
}

main().catch((error: unknown) => {
  logError('Crawl failed', error);
  process.exitCode = 1;
});
