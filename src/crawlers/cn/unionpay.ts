import type { SourceConfig } from '../../lib/schema';
import { emptyResult, type CrawlResult } from '../shared/types';

export const unionpaySource: SourceConfig = {
  id: 'cn-unionpay',
  region: 'CN',
  name: '银联优惠活动',
  url: 'https://youhui.95516.com/',
  reliability: 'official',
};

export async function crawlUnionPay(): Promise<CrawlResult> {
  return emptyResult(unionpaySource);
}
