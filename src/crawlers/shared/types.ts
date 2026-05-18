import type { CreditCard, Offer, SourceConfig } from '../../lib/schema';

export interface CrawlResult {
  source: SourceConfig;
  cards: CreditCard[];
  offers: Offer[];
  refreshedSourceUrls?: string[];
}

export type SourceParser = () => Promise<CrawlResult>;

export function emptyResult(source: SourceConfig): CrawlResult {
  return { source, cards: [], offers: [] };
}
