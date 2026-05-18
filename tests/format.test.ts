import { describe, expect, it } from 'vitest';
import { formatOfferCategory } from '../src/lib/format';

describe('formatOfferCategory', () => {
  it('localizes offer and reward category labels for display', () => {
    expect(formatOfferCategory('daily')).toBe('日常消费');
    expect(formatOfferCategory('cashback')).toBe('现金回赠');
    expect(formatOfferCategory('mobile-payment')).toBe('移动支付');
  });
});
