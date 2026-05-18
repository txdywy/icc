import type { SourceConfig } from '../../lib/schema';
import { emptyResult, type CrawlResult } from '../shared/types';

export const citiSource: SourceConfig = {
  id: 'us-citi',
  region: 'US',
  name: 'Citi 美国信用卡页',
  url: 'https://www.citi.com/credit-cards/',
  reliability: 'official',
};

export async function crawlCiti(): Promise<CrawlResult> {
  return emptyResult(citiSource);
}
