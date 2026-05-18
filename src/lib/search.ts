import Fuse from 'fuse.js';
import { parseISO } from 'date-fns';
import type { CreditCard, Offer, OfferCategory, Region } from './schema';

export type OfferSort = 'score' | 'expiring' | 'updated' | 'value' | 'minSpend';
export type CardSort = 'score' | 'updated' | 'annualFee' | 'welcomeValue';

export interface OfferFilters {
  region?: Region | 'all';
  issuer?: string;
  category?: OfferCategory | 'all';
  merchant?: string;
  expiringSoon?: boolean;
  requiresRegistration?: boolean;
  newCustomerOnly?: boolean;
  minScore?: number;
  query?: string;
}

export interface CardFilters {
  region?: Region | 'all';
  issuer?: string;
  minScore?: number;
  query?: string;
}

export function filterOffers(offers: Offer[], filters: OfferFilters): Offer[] {
  let result = [...offers];

  if (filters.region && filters.region !== 'all') result = result.filter((offer) => offer.region === filters.region);
  if (filters.issuer) result = result.filter((offer) => offer.issuer === filters.issuer);
  if (filters.category && filters.category !== 'all') result = result.filter((offer) => offer.category === filters.category);
  if (filters.merchant) result = result.filter((offer) => offer.merchant === filters.merchant);
  if (typeof filters.requiresRegistration === 'boolean') {
    result = result.filter((offer) => Boolean(offer.requiresRegistration) === filters.requiresRegistration);
  }
  if (filters.expiringSoon) result = result.filter((offer) => isExpiringSoon(offer.endDate));
  if (filters.newCustomerOnly) result = result.filter((offer) => /新户|welcome|new customer/i.test(searchableOfferText(offer)));
  if (typeof filters.minScore === 'number') result = result.filter((offer) => (offer.score ?? 0) >= filters.minScore!);
  if (filters.query?.trim()) result = searchOffers(result, filters.query.trim());

  return result;
}

export function sortOffers(offers: Offer[], sort: OfferSort): Offer[] {
  const result = [...offers];
  return result.sort((a, b) => {
    if (sort === 'expiring') return dateValue(a.endDate) - dateValue(b.endDate);
    if (sort === 'updated') return dateValue(b.lastCheckedAt) - dateValue(a.lastCheckedAt);
    if (sort === 'value') return (b.estimatedValue ?? b.maxDiscount ?? 0) - (a.estimatedValue ?? a.maxDiscount ?? 0);
    if (sort === 'minSpend') return (a.minSpend ?? Number.POSITIVE_INFINITY) - (b.minSpend ?? Number.POSITIVE_INFINITY);
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

export function filterCards(cards: CreditCard[], filters: CardFilters): CreditCard[] {
  let result = [...cards];

  if (filters.region && filters.region !== 'all') result = result.filter((card) => card.region === filters.region);
  if (filters.issuer) result = result.filter((card) => card.issuer === filters.issuer);
  if (typeof filters.minScore === 'number') result = result.filter((card) => (card.score ?? 0) >= filters.minScore!);
  if (filters.query?.trim()) result = searchCards(result, filters.query.trim());

  return result;
}

export function sortCards(cards: CreditCard[], sort: CardSort): CreditCard[] {
  const result = [...cards];
  return result.sort((a, b) => {
    if (sort === 'updated') return dateValue(b.lastCheckedAt) - dateValue(a.lastCheckedAt);
    if (sort === 'annualFee') return (a.annualFee?.amount ?? 0) - (b.annualFee?.amount ?? 0);
    if (sort === 'welcomeValue') return (b.welcomeOffer?.estimatedValue ?? 0) - (a.welcomeOffer?.estimatedValue ?? 0);
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

export function uniqueValues<T>(items: T[], getter: (item: T) => string | undefined): string[] {
  return [...new Set(items.map(getter).filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function searchOffers(offers: Offer[], query: string): Offer[] {
  const fuse = new Fuse(offers, {
    keys: ['title', 'issuer', 'merchant', 'cardNames', 'valueText', 'termsSummary', 'originalText'],
    threshold: 0.35,
    ignoreLocation: true,
  });
  return fuse.search(query).map((match) => match.item);
}

function searchCards(cards: CreditCard[], query: string): CreditCard[] {
  const fuse = new Fuse(cards, {
    keys: ['name', 'issuer', 'network', 'welcomeOffer.headline', 'rewards.rateText', 'perks', 'eligibility'],
    threshold: 0.35,
    ignoreLocation: true,
  });
  return fuse.search(query).map((match) => match.item);
}

function searchableOfferText(offer: Offer): string {
  return [offer.title, offer.valueText, offer.termsSummary, offer.originalText, offer.cardNames?.join(' ')].filter(Boolean).join(' ');
}

function isExpiringSoon(endDate: string | undefined): boolean {
  if (!endDate) return false;
  const days = (parseISO(endDate).getTime() - Date.now()) / 86_400_000;
  return days >= 0 && days <= 14;
}

function dateValue(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
}
