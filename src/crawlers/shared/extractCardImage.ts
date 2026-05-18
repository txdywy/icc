import type { CheerioAPI } from 'cheerio';
import { resolvePublicUrl } from './resolvePublicUrl';

export interface CardImage {
  url: string;
  alt: string;
  sourceUrl: string;
}

interface Candidate extends CardImage {
  score: number;
}

export function extractCardImage($: CheerioAPI, sourceUrl: string, cardNames: string[]): CardImage | undefined {
  const candidates: Candidate[] = [];

  $('img').each((_, element) => {
    const rawUrl = firstPresent(
      $(element).attr('src'),
      $(element).attr('data-src'),
      $(element).attr('data-original'),
      pickLargestSrcsetUrl($(element).attr('srcset')),
      pickLargestSrcsetUrl($(element).attr('data-srcset')),
    );
    const url = resolveImageUrl(rawUrl, sourceUrl);
    if (!url) return;

    const alt = $(element).attr('alt')?.replace(/\s+/g, ' ').trim();
    const context = [alt, rawUrl, $(element).attr('title'), $(element).attr('aria-label')].filter(Boolean).join(' ');
    candidates.push({
      url,
      alt: alt || `${cardNames[0] ?? '信用卡'}卡面图`,
      sourceUrl,
      score: scoreImageCandidate(context, cardNames, $(element).attr('width'), $(element).attr('height')),
    });
  });

  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, element) => {
    const url = resolveImageUrl($(element).attr('content'), sourceUrl);
    if (!url) return;
    const context = $(element).attr('content') ?? '';
    candidates.push({
      url,
      alt: `${cardNames[0] ?? '信用卡'}卡面图`,
      sourceUrl,
      score: scoreImageCandidate(context, cardNames, undefined, undefined),
    });
  });

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 5 ? { url: best.url, alt: best.alt, sourceUrl: best.sourceUrl } : undefined;
}

function resolveImageUrl(rawUrl: string | undefined, sourceUrl: string): string | undefined {
  if (!rawUrl?.trim()) return undefined;
  const resolved = resolvePublicUrl(rawUrl, sourceUrl);
  return resolved === sourceUrl ? undefined : resolved;
}

function firstPresent(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value?.trim());
}

function pickLargestSrcsetUrl(srcset: string | undefined): string | undefined {
  if (!srcset?.trim()) return undefined;
  return srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean)
    .at(-1);
}

function scoreImageCandidate(context: string, cardNames: string[], width: string | undefined, height: string | undefined): number {
  const lower = context.toLowerCase();
  let score = 0;

  for (const name of cardNames) {
    const normalized = name.toLowerCase();
    if (normalized && lower.includes(normalized)) score += 12;
    for (const token of normalized.split(/\s+/).filter((part) => part.length >= 4)) {
      if (lower.includes(token)) score += 2;
    }
  }

  if (/credit|card|visa|mastercard|amex|sapphire|venture|cashback|信用卡|卡面/.test(lower)) score += 5;
  if (/logo|icon|sprite|favicon|app-store|google-play|[/_-]bank[._/-]/.test(lower)) score -= 8;
  if (/banner|hero|background|campaign/.test(lower)) score -= 3;

  const ratio = imageRatio(width, height);
  if (ratio && ratio >= 1.35 && ratio <= 1.9) score += 5;

  return score;
}

function imageRatio(width: string | undefined, height: string | undefined): number | undefined {
  const w = width ? Number(width) : undefined;
  const h = height ? Number(height) : undefined;
  return w && h ? w / h : undefined;
}
