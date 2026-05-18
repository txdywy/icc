import type { SourceConfig } from '../../lib/schema';
import { emptyResult, type CrawlResult } from '../shared/types';

export const amexSource: SourceConfig = {
  id: 'us-amex',
  region: 'US',
  name: 'American Express 信用卡优惠页',
  url: 'https://www.americanexpress.com/us/credit-cards/',
  reliability: 'official',
};

export async function crawlAmex(): Promise<CrawlResult> {
  return emptyResult(amexSource);
}
