import type { CheerioAPI } from 'cheerio';
import { resolvePublicUrl } from './resolvePublicUrl';

export interface TextBlock {
  text: string;
  sourceUrl: string;
}

export function extractTextBlocks($: CheerioAPI, selector: string, sourceUrl: string, minLength = 24): TextBlock[] {
  const seen = new Set<string>();
  const blocks: TextBlock[] = [];

  $(selector).each((_, element) => {
    const text = normalizeText($(element).text());
    if (text.length < minLength) return;

    const href = $(element).is('a') ? $(element).attr('href') : $(element).find('a').first().attr('href');
    const resolvedUrl = resolvePublicUrl(href, sourceUrl);
    const key = `${resolvedUrl}|${text}`;
    if (seen.has(key)) return;

    seen.add(key);
    blocks.push({ text, sourceUrl: resolvedUrl });
  });

  return blocks;
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function safeSnippet(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  const chars = [...normalized];
  if (chars.length <= maxLength) return normalized;

  const snippet = chars.slice(0, Math.max(0, maxLength - 3)).join('').trim();
  const lastSpace = snippet.lastIndexOf(' ');
  return `${(lastSpace > 0 ? snippet.slice(0, lastSpace) : snippet).trim()}...`;
}
