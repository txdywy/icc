import { z } from 'zod';

export const regionSchema = z.enum(['CN', 'US', 'HK']);
export const currencySchema = z.enum(['CNY', 'USD', 'HKD']);
export const sourceReliabilitySchema = z.enum(['official', 'aggregator', 'community']);
export const offerCategorySchema = z.enum([
  'shopping',
  'dining',
  'travel',
  'hotel',
  'grocery',
  'transport',
  'mobile-payment',
  'installment',
  'welcome',
  'overseas',
  'other',
]);
export const discountTypeSchema = z.enum([
  'cashback',
  'statement-credit',
  'points',
  'miles',
  'coupon',
  'instant-discount',
  'installment-discount',
  'fee-waiver',
  'other',
]);

export const rewardSchema = z.object({
  category: z.string(),
  rateText: z.string(),
  estimatedRate: z.number().nonnegative().optional(),
  cap: z.string().optional(),
});

export const creditCardSchema = z.object({
  id: z.string().min(1),
  region: regionSchema,
  issuer: z.string().min(1),
  name: z.string().min(1),
  network: z.array(z.string()).optional(),
  annualFee: z
    .object({
      amount: z.number().nonnegative(),
      currency: currencySchema,
      waiver: z.string().optional(),
    })
    .optional(),
  welcomeOffer: z
    .object({
      headline: z.string().min(1),
      estimatedValue: z.number().nonnegative().optional(),
      currency: currencySchema.optional(),
      spendRequirement: z.number().nonnegative().optional(),
      spendPeriodDays: z.number().positive().optional(),
    })
    .optional(),
  rewards: z.array(rewardSchema),
  perks: z.array(z.string()),
  eligibility: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageAlt: z.string().optional(),
  imageSourceUrl: z.string().url().optional(),
  applyUrl: z.string().url().optional(),
  sourceUrls: z.array(z.string().url()).min(1),
  lastCheckedAt: z.string().datetime(),
  score: z.number().min(0).max(100).optional(),
  scoreBreakdown: z.record(z.string(), z.number()).optional(),
});

export const offerSchema = z.object({
  id: z.string().min(1),
  region: regionSchema,
  issuer: z.string().min(1),
  cardNames: z.array(z.string()).optional(),
  title: z.string().min(1),
  merchant: z.string().optional(),
  category: offerCategorySchema,
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  discountType: discountTypeSchema,
  valueText: z.string().min(1),
  estimatedValue: z.number().nonnegative().optional(),
  currency: currencySchema.optional(),
  minSpend: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().optional(),
  quotaText: z.string().optional(),
  requiresRegistration: z.boolean().optional(),
  usageLimit: z.string().optional(),
  termsSummary: z.string().optional(),
  originalText: z.string().optional(),
  sourceUrl: z.string().url(),
  sourceReliability: sourceReliabilitySchema,
  lastCheckedAt: z.string().datetime(),
  score: z.number().min(0).max(100).optional(),
  scoreBreakdown: z.record(z.string(), z.number()).optional(),
});

export const sourceStatusSchema = z.object({
  id: z.string().min(1),
  region: regionSchema,
  name: z.string().min(1),
  url: z.string().url(),
  status: z.enum(['success', 'failed']),
  lastCheckedAt: z.string().datetime(),
  error: z.string().optional(),
  itemCount: z.number().int().nonnegative(),
});

export const metadataSchema = z.object({
  lastUpdatedAt: z.string().datetime(),
  totalCards: z.number().int().nonnegative(),
  totalOffers: z.number().int().nonnegative(),
  sources: z.array(sourceStatusSchema),
});

export const sourceConfigSchema = z.object({
  id: z.string().min(1),
  region: regionSchema,
  name: z.string().min(1),
  url: z.string().url(),
  reliability: sourceReliabilitySchema,
});

export type Region = z.infer<typeof regionSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type SourceReliability = z.infer<typeof sourceReliabilitySchema>;
export type OfferCategory = z.infer<typeof offerCategorySchema>;
export type DiscountType = z.infer<typeof discountTypeSchema>;
export type Reward = z.infer<typeof rewardSchema>;
export type CreditCard = z.infer<typeof creditCardSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export type SourceConfig = z.infer<typeof sourceConfigSchema>;
