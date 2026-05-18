export function logInfo(message: string): void {
  console.log(`[cardradar] ${message}`);
}

export function logError(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[cardradar] ${message}: ${detail}`);
}
