import type { SourceConfig } from '../../lib/schema';
import { emptyResult, type CrawlResult } from '../shared/types';

export const citicSource: SourceConfig = {
  id: 'cn-citic',
  region: 'CN',
  name: '中信银行信用卡活动',
  url: 'https://creditcard.ecitic.com/',
  reliability: 'official',
};

export async function crawlCitic(): Promise<CrawlResult> {
  return emptyResult(citicSource);
}
