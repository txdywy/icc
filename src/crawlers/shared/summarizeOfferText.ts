export function summarizeOfferText(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const points = extractPoints(normalized);
  const amount = extractAmount(normalized);
  const category = inferCategoryLabel(normalized);
  const value = points ? `，最高约 ${points} 点` : amount ? `，最高约 ${amount}` : '';

  if (/mox\s+credit/i.test(normalized)) return `Mox Credit 信用卡${category}${value}`;
  if (/asia\s+miles|里數/i.test(normalized)) return `Asia Miles ${category}${value}`;
  return `${category}${value}`;
}

function inferCategoryLabel(text: string): string {
  if (/sign[ -]?up|bonus|points after|miles after|开卡奖励/i.test(text)) return '开卡奖励优惠';
  if (/welcome|迎新|new customer|new customers|join|open (?:an )?account|开卡|首刷/i.test(text)) return '迎新优惠';
  if (/cashback|cash back|cash rebate|回贈|返现|现金/i.test(text)) return '现金回赠优惠';
  if (/miles|里數|里程/i.test(text)) return '里程优惠';
  if (/promo code|code|coupon|voucher|優惠碼|券/i.test(text)) return '优惠码活动';
  if (/installment|instalment|分期/i.test(text)) return '分期优惠';
  if (/discount|offer|promotion|优惠|折扣|满\s*\d+\s*减\s*\d+/i.test(text)) return '信用卡优惠';
  return '公开优惠';
}

function extractAmount(text: string): string | undefined {
  const normalized = text.replace(/,/g, '');
  const hkd = normalized.match(/(?:HK\$|HKD)\s*(\d+(?:\.\d+)?)/i);
  if (hkd?.[1]) return formatPositiveAmount(Number(hkd[1]), 'HK$');

  const usd = normalized.match(/(?:US\$|USD|\$)\s*(\d+(?:\.\d+)?)/i);
  if (usd?.[1]) return formatPositiveAmount(Number(usd[1]), 'US$');

  const cny = normalized.match(/(?:¥|￥|CNY|RMB|满)\s*(\d+(?:\.\d+)?)/i);
  if (cny?.[1]) return formatPositiveAmount(Number(cny[1]), '¥');

  return undefined;
}

function extractPoints(text: string): string | undefined {
  const points = text.replace(/,/g, '').match(/(\d{2,6})\s*(?:points|pts|membership rewards|ultimate rewards|miles|里程|积分)/i);
  if (!points?.[1]) return undefined;
  const amount = Number(points[1]);
  return amount > 0 ? amount.toLocaleString('en-US') : undefined;
}

function formatPositiveAmount(amount: number, prefix: string): string | undefined {
  return amount > 0 ? `${prefix}${amount.toLocaleString('en-US')}` : undefined;
}
