import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  creditCardSchema,
  metadataSchema,
  offerSchema,
  sourceConfigSchema,
  type CreditCard,
  type Metadata,
  type Offer,
  type Region,
  type SourceConfig,
} from './schema';

const dataDir = join(process.cwd(), 'public', 'data');
const regions: Region[] = ['CN', 'US', 'HK'];

export function getCards(region?: Region): CreditCard[] {
  const cards = regions.flatMap((item) => readJsonArray(join(dataDir, 'cards', `${item.toLowerCase()}.json`), creditCardSchema));
  return region ? cards.filter((card) => card.region === region) : cards;
}

export function getOffers(region?: Region): Offer[] {
  const offers = regions.flatMap((item) => readJsonArray(join(dataDir, 'offers', `${item.toLowerCase()}.json`), offerSchema));
  return region ? offers.filter((offer) => offer.region === region) : offers;
}

export function getMetadata(): Metadata {
  return metadataSchema.parse(readJson(join(dataDir, 'metadata.json')));
}

export function getSources(): SourceConfig[] {
  return z.array(sourceConfigSchema).parse(readJson(join(dataDir, 'sources.json')));
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonArray<T extends z.ZodTypeAny>(path: string, schema: T): z.infer<T>[] {
  return z.array(schema).parse(readJson(path));
}
