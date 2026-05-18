import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CreditCard, Offer } from './schema';

type ScoredCard = CreditCard & { score: number; scoreBreakdown: Record<string, number> };
type ScoredOffer = Offer & { score: number; scoreBreakdown: Record<string, number> };

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 10) / 10;

export function scoreCard(card: CreditCard): ScoredCard {
  const welcomeValue = card.welcomeOffer?.estimatedValue ?? 0;
  const spendRequirement = card.welcomeOffer?.spendRequirement ?? 0;
  const annualFee = card.annualFee?.amount ?? 0;
  const bestRewardRate = Math.max(0, ...card.rewards.map((reward) => reward.estimatedRate ?? 0));
  const hasTransferLanguage = [...card.perks, card.welcomeOffer?.headline ?? '', ...card.rewards.map((reward) => reward.rateText)]
    .join(' ')
    .toLowerCase();

  const welcomeOffer = clamp((welcomeValue / Math.max(annualFee + spendRequirement * 0.02, 1)) * 25, 0, 25);
  const rewards = clamp(bestRewardRate * 400, 0, 20);
  const annualFeeValue = clamp(15 - annualFee / 80 + card.perks.length * 2 + (card.annualFee?.waiver ? 4 : 0), 0, 15);
  const perks = clamp(card.perks.length * 3 + (hasTransferLanguage.includes('insurance') ? 2 : 0), 0, 15);
  const flexibility = clamp(
    (hasTransferLanguage.includes('transfer') || hasTransferLanguage.includes('里程') || hasTransferLanguage.includes('miles') ? 7 : 2) +
      (card.network?.length ? Math.min(card.network.length, 3) : 1),
    0,
    10,
  );
  const accessibility = clamp(8 + (card.eligibility ? 1 : 0) - (annualFee > 500 ? 2 : 0), 0, 10);
  const transparency = clamp(5 - (card.sourceUrls.length === 0 ? 5 : 0) - (card.welcomeOffer && !spendRequirement ? 1 : 0), 0, 5);

  const scoreBreakdown = {
    welcomeOffer: round(welcomeOffer),
    rewards: round(rewards),
    annualFeeValue: round(annualFeeValue),
    perks: round(perks),
    flexibility: round(flexibility),
    accessibility: round(accessibility),
    transparency: round(transparency),
  };

  return {
    ...card,
    scoreBreakdown,
    score: round(Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)),
  };
}

export function scoreOffer(offer: Offer, now = new Date()): ScoredOffer {
  const effectiveRateValue = offer.estimatedValue && offer.minSpend ? offer.estimatedValue / offer.minSpend : 0;
  const effectiveRate = clamp(effectiveRateValue * 120, 0, 30);
  const maxSavings = clamp(((offer.maxDiscount ?? offer.estimatedValue ?? 0) / currencyScale(offer.currency)) * 20, 0, 20);
  const audienceBreadth = clamp(
    15 - (offer.cardNames?.length ? Math.min(offer.cardNames.length, 4) : 0) - (targetedText(offer) ? 4 : 0),
    0,
    15,
  );
  const convenience = clamp(10 - (offer.requiresRegistration ? 3 : 0) - (offer.discountType === 'installment-discount' ? 4 : 0), 0, 10);
  const urgency = scoreUrgency(offer.endDate, now);
  const certainty = clamp(10 - (quotaRiskText(offer) ? 4 : 0) - (randomText(offer) ? 2 : 0), 0, 10);
  const sourceReliability = offer.sourceReliability === 'official' ? 5 : offer.sourceReliability === 'aggregator' ? 3 : 1;
  const riskPenalty = scoreOfferRiskPenalty(offer, now);

  const scoreBreakdown = {
    effectiveRate: round(effectiveRate),
    maxSavings: round(maxSavings),
    audienceBreadth: round(audienceBreadth),
    convenience: round(convenience),
    urgency: round(urgency),
    certainty: round(certainty),
    sourceReliability,
    riskPenalty: -riskPenalty,
  };

  return {
    ...offer,
    scoreBreakdown,
    score: round(clamp(Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0))),
  };
}

function currencyScale(currency: Offer['currency']): number {
  if (currency === 'USD') return 50;
  if (currency === 'HKD') return 350;
  return 300;
}

function scoreUrgency(endDate: string | undefined, now: Date): number {
  if (!endDate) return 4;
  const days = differenceInCalendarDays(parseISO(endDate), now);
  if (days < 0) return 0;
  if (days <= 7) return 10;
  if (days <= 30) return 8;
  if (days <= 90) return 6;
  return 4;
}

function offerText(offer: Offer): string {
  return [offer.title, offer.valueText, offer.quotaText, offer.termsSummary, offer.originalText, offer.usageLimit]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function randomText(offer: Offer): boolean {
  return /随机|random|mystery/.test(offerText(offer));
}

function quotaRiskText(offer: Offer): boolean {
  return /名额极少|限量|先到先得|limited quota|while supplies last/.test(offerText(offer));
}

function targetedText(offer: Offer): boolean {
  return /定向|受邀|邀请|targeted|selected|eligible users|登录/.test(offerText(offer));
}

function scoreOfferRiskPenalty(offer: Offer, now: Date): number {
  const text = offerText(offer);
  let penalty = 0;

  if (randomText(offer)) penalty += 6;
  if (quotaRiskText(offer)) penalty += 5;
  if (offer.discountType === 'installment-discount' || /分期|installment|手续费|interest/.test(text)) penalty += 7;
  if (/规则复杂|复杂|complex|多重限制/.test(text)) penalty += 4;
  if (offer.endDate && differenceInCalendarDays(parseISO(offer.endDate), now) < 0) penalty += 12;
  if (targetedText(offer)) penalty += 5;
  if (offer.requiresRegistration) penalty += 2;

  return penalty;
}
