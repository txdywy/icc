export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export function extractDateRange(text: string): DateRange {
  const dates = extractDates(text);
  const range: DateRange = {};
  const startDate = dates[0];
  const endDate = dates[1] ?? startDate;
  if (startDate) range.startDate = startDate;
  if (endDate) range.endDate = endDate;
  return range;
}

export function extractDates(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ');
  const results: string[] = [];
  const patterns = [
    /(20\d{2})[年/-](\d{1,2})[月/-](\d{1,2})/g,
    /(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2})/g,
    /(20\d{2})\.(\d{1,2})\.(\d{1,2})/g,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const iso = match[1]?.startsWith('20')
        ? toIso(match[1], match[2], match[3])
        : toIso(match[3], match[2], match[1]);
      if (iso && !results.includes(iso)) results.push(iso);
    }
  }

  return results;
}

function toIso(year: string | undefined, month: string | undefined, day: string | undefined): string | undefined {
  if (!year || !month || !day) return undefined;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
