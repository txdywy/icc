import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import {
  creditCardSchema,
  metadataSchema,
  offerSchema,
  sourceConfigSchema,
  type Region,
} from '../src/lib/schema';

const dataDir = join(process.cwd(), 'public', 'data');
const regions: Region[] = ['CN', 'US', 'HK'];

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function validate(): Promise<void> {
  for (const region of regions) {
    const regionLower = region.toLowerCase();
    z.array(creditCardSchema).parse(await readJson(join(dataDir, 'cards', `${regionLower}.json`)));
    z.array(offerSchema).parse(await readJson(join(dataDir, 'offers', `${regionLower}.json`)));
  }

  z.array(sourceConfigSchema).parse(await readJson(join(dataDir, 'sources.json')));
  metadataSchema.parse(await readJson(join(dataDir, 'metadata.json')));
  console.log('Data validation passed.');
}

validate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
