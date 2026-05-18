import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Currency, Region, SourceReliability } from './schema';

const regionLabels: Record<Region, string> = {
  CN: '中国大陆',
  US: '美国',
  HK: '香港',
};

const reliabilityLabels: Record<SourceReliability, string> = {
  official: '官方',
  aggregator: '聚合站',
  community: '社区',
};

const offerCategoryLabels: Record<string, string> = {
  shopping: '购物',
  dining: '餐饮',
  travel: '旅行',
  hotel: '酒店',
  grocery: '超市',
  transport: '交通',
  'mobile-payment': '移动支付',
  installment: '分期',
  welcome: '迎新',
  overseas: '境外',
  cashback: '现金回赠',
  daily: '日常消费',
  other: '其他',
};

const sourceStatusLabels = {
  success: '成功',
  failed: '失败',
  pending: '待检查',
} as const;

export function formatRegion(region: Region): string {
  return regionLabels[region];
}

export function formatReliability(reliability: SourceReliability): string {
  return reliabilityLabels[reliability];
}

export function formatOfferCategory(category: string): string {
  return offerCategoryLabels[category] ?? category;
}

export function formatSourceStatus(status: string | undefined): string {
  if (status === 'success' || status === 'failed') return sourceStatusLabels[status];
  if (!status || status === 'pending') return sourceStatusLabels.pending;
  return status;
}

export function formatMoney(amount: number | undefined, currency: Currency | undefined): string {
  if (amount === undefined) return '未披露';
  const locale = currency === 'USD' ? 'en-US' : currency === 'HKD' ? 'zh-HK' : 'zh-CN';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency ?? 'CNY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(value: string | undefined): string {
  if (!value) return '未注明';
  return format(parseISO(value), 'yyyy-MM-dd');
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return '未注明';
  return format(parseISO(value), 'yyyy-MM-dd HH:mm');
}

export function formatRelativeTime(value: string | undefined): string {
  if (!value) return '未知';
  return formatDistanceToNowStrict(parseISO(value), { addSuffix: true, locale: zhCN });
}

export function scoreTone(score: number | undefined): string {
  if ((score ?? 0) >= 80) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if ((score ?? 0) >= 65) return 'text-blue-700 bg-blue-50 border-blue-200';
  if ((score ?? 0) >= 45) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-slate-600 bg-slate-50 border-slate-200';
}
