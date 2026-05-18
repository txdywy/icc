import type { Currency } from '../../lib/schema';

export interface MoneyMatch {
  amount: number;
  currency: Currency;
}

export function normalizeMoney(text: string): MoneyMatch | undefined {
  const normalized = text.replace(/,/g, '');
  const currency = detectCurrency(normalized);
  const patterns = [
    /(?:HK\$|HKD)\s*(\d+(?:\.\d+)?)/i,
    /(?:US\$|USD|\$)\s*(\d+(?:\.\d+)?)/i,
    /(?:¥|￥|CNY|RMB)\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:元|港元|美元|HKD|USD|CNY|RMB)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const amount = match?.[1] ? Number(match[1]) : undefined;
    if (amount !== undefined && Number.isFinite(amount)) return { amount, currency };
  }

  return undefined;
}

function detectCurrency(text: string): Currency {
  if (/HK\$|HKD|港元/i.test(text)) return 'HKD';
  if (/US\$|USD|美元|\$/i.test(text)) return 'USD';
  return 'CNY';
}
