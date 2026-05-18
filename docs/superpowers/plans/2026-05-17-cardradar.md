# CardRadar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully static Astro + TypeScript credit-card offer intelligence site with scheduled GitHub Actions data crawling and GitHub Pages deployment.

**Architecture:** Astro renders static pages from JSON files in `public/data`; browser-side TypeScript powers filtering, sorting, and keyword search. Node.js TypeScript crawlers fetch public HTML sources, parse defensively with Cheerio, validate with Zod schemas, score records, dedupe offers, and write JSON plus metadata so deploys remain stable even if individual sources fail.

**Tech Stack:** Astro, TypeScript, Tailwind CSS, Cheerio, Zod, Fuse.js, date-fns, tsx, ESLint/Prettier, GitHub Actions.

---

## File Structure

- `package.json`: scripts and dependencies for Astro, crawlers, validation, linting, formatting.
- `astro.config.mjs`, `tailwind.config.mjs`, `tsconfig.json`, `.gitignore`: project configuration.
- `src/lib/schema.ts`: canonical Zod schemas and exported TypeScript types.
- `src/lib/scoring.ts`: deterministic `scoreCard` and `scoreOffer` functions with breakdowns.
- `src/lib/search.ts`: browser-side filter, sort, and Fuse search helpers.
- `src/lib/format.ts`: date, money, region, reliability, and score formatting helpers.
- `src/crawlers/shared/*.ts`: HTTP fetch, date extraction, money normalization, dedupe, logging, seed fallback, validation helpers.
- `src/crawlers/cn/*.ts`, `src/crawlers/us/*.ts`, `src/crawlers/hk/*.ts`: source-specific parsers. Parser failures throw locally and are captured by the orchestrator.
- `src/crawlers/index.ts`: crawler orchestrator that runs all source parsers, merges seed data, scores, dedupes, validates, writes JSON, and metadata.
- `scripts/validate-data.ts`: validates `public/data` JSON independently.
- `public/data/cards/*.json`, `public/data/offers/*.json`, `public/data/sources.json`, `public/data/metadata.json`: seed data and crawler outputs.
- `src/components/*.astro`: reusable cards, filters, score badges, source status UI.
- `src/layouts/BaseLayout.astro`: shared document shell and navigation.
- `src/pages/*.astro`: homepage, regional pages, cards, offers, methodology, sources.
- `.github/workflows/update-data.yml`: scheduled crawl + validate + commit-if-changed.
- `.github/workflows/deploy.yml`: GitHub Pages static deployment.
- `README.md`: setup, deployment, data sources, adding parsers, scoring, disclaimer.

---

## Tasks

### Task 1: Project scaffold and configuration

**Files:** create project config files and directories.

- [ ] Create `package.json` with scripts: `dev`, `build`, `preview`, `crawl`, `validate:data`, `lint`, `typecheck`, `format`.
- [ ] Create Astro, Tailwind, TypeScript, Prettier, ESLint, and gitignore config.
- [ ] Run `npm install` to generate `package-lock.json`.
- [ ] Run `npm run typecheck`; expected to pass once source files exist or fail only because source is not yet implemented.

### Task 2: Data contracts and scoring core

**Files:** `src/lib/schema.ts`, `src/lib/scoring.ts`, `src/lib/format.ts`.

- [ ] Define `Region`, `Currency`, `CreditCard`, `Offer`, `SourceStatus`, and `Metadata` Zod schemas exactly matching the requested model plus source metadata.
- [ ] Implement `scoreCard(card)` with weighted categories totaling 100.
- [ ] Implement `scoreOffer(offer)` with weighted categories totaling 100 and risk deductions for random/limited/installment/complex/expired/login-targeted signals.
- [ ] Implement formatting helpers used by Astro components.
- [ ] Run `npm run typecheck`; expected PASS.

### Task 3: Seed data and validation

**Files:** `public/data/**`, `scripts/validate-data.ts`.

- [ ] Write representative seed cards/offers for CN, US, and HK with real source URLs and timestamps.
- [ ] Implement `validate-data.ts` to parse every JSON file through Zod.
- [ ] Run `npm run validate:data`; expected PASS.

### Task 4: Shared crawler infrastructure

**Files:** `src/crawlers/shared/*.ts`.

- [ ] Implement `fetchHtml(url)` using global fetch, timeout, user-agent, and non-OK error messages.
- [ ] Implement `extractDates(text)`, `normalizeMoney(text)`, `dedupeOffers(offers)`, and logger helpers.
- [ ] Keep helpers deterministic and dependency-light.
- [ ] Run `npm run typecheck`; expected PASS.

### Task 5: Source parsers and orchestrator

**Files:** `src/crawlers/index.ts`, `src/crawlers/cn/*.ts`, `src/crawlers/us/*.ts`, `src/crawlers/hk/*.ts`.

- [ ] Implement CN parsers: CMBC activity parser, Ping An basic parser, and empty extensible parsers for UnionPay, CITIC, CMB.
- [ ] Implement US parsers: Chase Sapphire Preferred and Capital One Venture X card parsers, Amex/Citi placeholders.
- [ ] Implement HK parsers: Hang Seng offers, Citi HK welcome offer, Mox promotions, OCBC HK promotions.
- [ ] Implement source result contract: `{ source, cards, offers }` or captured failure metadata.
- [ ] Merge parser results with seed fallback, score all records, dedupe, validate, and write JSON.
- [ ] Run `npm run crawl`; expected PASS even if some remote sources fail.

### Task 6: Astro UI components and pages

**Files:** `src/layouts/BaseLayout.astro`, `src/components/*.astro`, `src/pages/*.astro`, `src/styles/global.css`.

- [ ] Implement dashboard layout, navigation, responsive cards, score badge, offer/card cards, filters, and source status table.
- [ ] Implement homepage and routes: `/cn`, `/us`, `/hk`, `/cards`, `/offers`, `/methodology`, `/sources`.
- [ ] Ensure pages use static JSON imports or build-time file reads only.
- [ ] Implement client-side filter/sort/search script for list pages.
- [ ] Run `npm run build`; expected PASS.

### Task 7: GitHub Actions and README

**Files:** `.github/workflows/update-data.yml`, `.github/workflows/deploy.yml`, `README.md`.

- [ ] Add scheduled crawl workflow at UTC `01:00`, `07:00`, `13:00`, `19:00` plus manual dispatch; commit only if `public/data` changed.
- [ ] Add GitHub Pages deploy workflow.
- [ ] Write README with local dev, deployment, adding data sources, scoring, source transparency, and disclaimers.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run crawl`, `npm run validate:data`, and `npm run build`.

### Task 8: Final verification and cleanup

**Files:** all changed files.

- [ ] Inspect `git status --short` for unexpected files.
- [ ] Fix any lint/type/build/crawl errors.
- [ ] Report exact verification commands and outcomes.

---

## Self-Review

- Spec coverage: The plan covers static Astro pages, JSON data storage, crawler sources, schema, scoring, filtering, GitHub Actions, seed fallback, metadata, and README.
- Placeholder scan: All parser placeholders are explicit required extensibility stubs for sources the user requested as placeholders; no implementation step is left as undefined work.
- Type consistency: Schema names and fields match the requested `CreditCard`, `Offer`, and metadata structures.
