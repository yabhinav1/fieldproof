# FieldProof

AI-powered impact and sustainability media platform built on Cloudinary.
Code Cubicle 2026 · Problem Statement 02.

NGOs upload raw field photos. FieldProof organises them by project, site and time, shows before-and-after change with an AI explanation, makes everything searchable in plain English, and generates impact reports where every image traces back to its original Cloudinary asset.

## Quick start

```bash
npm install
cp .env.example .env      # fill in keys as you get them; everything is optional to boot
npm run seed              # creates the demo project + 3 sites
npm run dev               # http://localhost:3000
curl http://localhost:3000/api/health
```

With no `DATABASE_URL`, an embedded Postgres (PGlite, with pgvector) is created in `./.pglite`. Set `DATABASE_URL` to a Neon connection string to use a real database; migrations run automatically on boot.

Everything runs on free tiers. No card is needed for any of it.

| Integration | Env | Cost | Without it |
|---|---|---|---|
| Cloudinary | `CLOUDINARY_URL` | free | Uploads, ingest, comparisons and reports return 503 |
| Cloudinary add-ons | `CLOUDINARY_AUTO_TAGGING`, `CLOUDINARY_CAPTIONING` | free quota | No AI tags / captions; EXIF, GPS, phash still work |
| Gemini (Google AI Studio) | `GEMINI_API_KEY` | free | Comparisons and report narratives return 503; search is keyword-only |
| Anthropic (alternative to Gemini) | `ANTHROPIC_API_KEY` | paid | Not needed when Gemini is set |
| Voyage AI (alternative embeddings) | `VOYAGE_API_KEY` | free | Not needed when Gemini is set |
| Neon Postgres | `DATABASE_URL` | free | Embedded PGlite is used (local only) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run typecheck` / `npm test` | Type check / run unit + PGlite integration tests |
| `npm run seed` | Create the Green Yamuna demo project and sites |
| `npm run upload -- --project green-yamuna --dir ./data` | Upload a folder to Cloudinary and ingest it (see script header for folder conventions) |
| `npm run cloudinary:setup` | Register named transformations and structured metadata fields in Cloudinary |
| `npm run db:generate` | Regenerate SQL migrations after editing `src/server/db/schema.ts` |

## Architecture

```
Browser ──upload──► Cloudinary ◄──explicit / url──┐
   │                                              │
   └──JSON──► Next.js route handlers (src/app/api/*)
                 └── services (src/server/services/*)
                       ├── Postgres via Drizzle (Neon in prod, PGlite locally)
                       ├── Cloudinary SDK: tagging, captioning, EXIF, phash, transformations, overlays
                       ├── Gemini or Claude vision (JSON-schema outputs): before/after assessment, report narrative
                       └── Gemini or Voyage embeddings + pgvector: hybrid semantic + keyword search
```

Key directories:

- `src/server/db/schema.ts` — tables: projects, sites, assets, comparisons, reports, provenance
- `src/server/services/ingest.ts` — upload → EXIF → site by GPS → phase by date → verification → embedding
- `src/server/lib/verify.ts` — duplicate (phash), GPS, date and phase-order checks
- `src/server/ai/structured.ts` — one entry point for schema-constrained generation; dispatches to Gemini or Anthropic
- `src/server/ai/compare.ts`, `narrative.ts` — the two prompts, Zod-validated on the way back
- `src/server/cloudinary.ts` — all Cloudinary usage; every derived URL is recorded in `provenance`

Frontend lives in `src/app/(app)` and `src/components` (not started yet). Backend code never imports from there.

## API

All responses are `{ ok: true, data }` or `{ ok: false, error, details? }`. IDs are UUIDs. Dates are ISO strings.

### Health
`GET /api/health` → database driver and which integrations are configured.

### Projects and sites
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/projects` | | projects with `siteCount`, `assetCount` |
| POST | `/api/projects` | `{ name, slug?, description?, orgName?, duringStart?, afterStart? }` | project |
| GET | `/api/projects/:id` | | project + `sites[]` (each with `assetCounts`) + `totals` + `unassignedAssets` |
| PATCH | `/api/projects/:id` | any of the create fields | project |
| DELETE | `/api/projects/:id` | | `{ deleted }` |
| GET | `/api/projects/:id/sites` | | sites |
| POST | `/api/projects/:id/sites` | `{ name, lat, lng, description?, radiusM? }` | site |
| GET | `/api/projects/:id/timeline` | | `[{ siteId, before[], during[], after[], unknown[] }]` oldest first |

`duringStart` / `afterStart` define phases: captured before `duringStart` = **before**, between = **during**, after `afterStart` = **after**.

### Upload and ingest
1. `POST /api/uploads/sign` with `{ projectId, siteId? }` → `{ cloudName, apiKey, timestamp, signature, folder, params, uploadUrl }`.
2. Upload to `uploadUrl` as multipart form: `file`, `api_key`, `signature`, and **every key in `params` unchanged**. Or pass these to the Cloudinary Upload Widget as `uploadSignature`.
3. `POST /api/assets/ingest` with `{ projectId, publicIds: string[], siteId?, phase?, analyze? }` → `{ summary, results[] }`.

Ingest runs Cloudinary analysis (tags, caption, EXIF, phash, colours), assigns site by GPS proximity and phase by EXIF date, runs verification, and embeds for search. Re-ingesting the same `public_id` updates in place.

### Assets
| Method | Path | Query / body | Returns |
|---|---|---|---|
| GET | `/api/assets` | `projectId` (required), `siteId`, `phase`, `verified=true|false`, `from`, `to`, `limit`, `offset` | assets, newest first |
| GET | `/api/assets/:id` | | asset + `site` + `provenance { source, exif, ai, derivations[] }` |
| PATCH | `/api/assets/:id` | `{ siteId?, phase?, resetPhase?, verified? }` | asset |
| DELETE | `/api/assets/:id` | | `{ deleted }` |

Asset fields the UI will use: `secureUrl`, `cloudinaryPublicId`, `phase`, `capturedAt`, `lat`, `lng`, `siteId`, `aiTags[]`, `aiCaption`, `verified`, `flags[] { code, message, relatedAssetId? }`, `width`, `height`, `colors`.

Flag codes: `no_gps`, `no_capture_date` (informational), `far_from_site`, `no_site_match`, `future_date`, `duplicate`, `phase_order`. `verified` is false when a blocking flag is present; reports skip unverified assets by default.

### Before and after
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/sites/:id/suggest-pair` | | `{ beforeAssetId, afterAssetId, strategy }` or `null` |
| POST | `/api/comparisons` | `{ beforeAssetId, afterAssetId }` | comparison (takes ~10–30 s) |
| GET | `/api/comparisons?projectId=&siteId=` | | comparisons, newest first |
| GET | `/api/comparisons/:id` | | comparison |
| DELETE | `/api/comparisons/:id` | | `{ deleted }` |

Comparison fields: `beforeUrl`, `afterUrl` (same 1024×768 crop for the slider), `headline`, `summary`, `sameLocation`, `locationConfidence`, `metrics[] { name, direction, reason }` where name ∈ `vegetation_cover | waste_and_debris | water_clarity | human_activity | infrastructure` and direction ∈ `increased | decreased | unchanged | not_visible`.

### Search
`GET /api/search?q=plastic+waste+near+river&projectId=…&siteId=&phase=&from=&to=&verifiedOnly=true&limit=30`
→ `{ mode: "hybrid" | "keyword", hits: [{ asset, score, matchedBy: ["semantic" | "keyword"] }] }`

### Reports
| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/reports` | `{ projectId, title?, includeFlagged? }` | report metadata + `htmlUrl` (takes ~20–60 s) |
| GET | `/api/reports?projectId=` | | report list |
| GET | `/api/reports/:id` | | report `content` (structured), `campaignImageUrl`, `assetIds`, `comparisonIds`, `htmlUrl` |
| GET | `/api/reports/:id/html` | | self-contained HTML page (iframe it, or print to PDF) |
| GET | `/api/reports/:id/sources` | | original assets behind the report |
| DELETE | `/api/reports/:id` | | `{ deleted }` (source assets untouched) |

`content` shape: `{ title, executiveSummary, keyNumbers[{label,value}], sites[{siteId, siteName, narrative, assetCount, heroComparisonId?}], callToAction, generatedAt }`.

### Provenance
Every derived image (thumbnail, comparison crop, report hero, campaign image) is stored in `provenance` with the exact Cloudinary transformation string and the comparison/report it was made for. `GET /api/assets/:id` returns it all under `provenance.derivations`.

## Gemini free tier notes

- Default model is `gemini-3.5-flash-lite` because it is the only tier that answers reliably on a free key; the full flash models return 503 "high demand" most of the time. The backend falls back down `GEMINI_FALLBACK_MODELS` automatically and remembers busy models for two minutes.
- Comparisons take 10–30 s and reports 30–90 s on the free tier. Generate them one at a time during a demo.
- Cloudinary add-ons (tagging, captioning) do **not** run on the `samples/` images Cloudinary preloads into new accounts. Upload your own photos.

## Demo data

```bash
npm run seed
# put photos under ./data/<site folder>/<before|during|after>/*.jpg, e.g. data/site-a/before/IMG_001.jpg
npm run upload -- --project green-yamuna --dir ./data
```

Folder names that start like a site name ("site-a", "Site A") pin the site; a `before|during|after` folder pins the phase. Otherwise GPS and EXIF decide and anything ambiguous is flagged for review.

## Deploy

Vercel: import the repo, set the env vars from `.env.example`, done. Route handlers set `maxDuration` for the slow AI endpoints. Use a Neon pooled connection string for `DATABASE_URL`.
