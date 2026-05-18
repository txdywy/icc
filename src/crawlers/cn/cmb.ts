import type { SourceConfig } from '../../lib/schema';
import { emptyResult, type CrawlResult } from '../shared/types';

export const cmbSource: SourceConfig = {
  id: 'cn-cmb',
  region: 'CN',
  name: '招商银行信用卡活动',
  url: 'https://cc.cmbchina.com/',
  reliability: 'official',
};

export async function crawlCmb(): Promise<CrawlResult> {
  return emptyResult(cmbSource);
}
