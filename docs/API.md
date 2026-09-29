# FieldProof API

Every route lives under `/api`. Try them against the [live demo](https://fieldproof-kappa.vercel.app/api/health) or a local server.

[← Back to the README](../README.md)

All responses are `{ ok: true, data }` or `{ ok: false, error, details? }`. IDs are UUIDs. Dates are ISO strings.

`error` is always a message that can be shown to a user. Statuses: `400` invalid input (including an id that is not a UUID), `404` not found, `409` conflict such as a project slug that is already taken, `429` AI provider rate limit, `502` / `503` a provider failed or is not configured. A `500` never includes internals in production. When `PROTECT_DEMO_DATA=true`, every `DELETE` answers `403`.

A bare date in a `to` filter, such as `to=2026-09-01`, includes that whole day.

## Health
`GET /api/health` → database driver and which integrations are configured.

## Projects and sites
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/projects` | | projects with `siteCount`, `assetCount` |
| POST | `/api/projects` | `{ name, slug?, description?, orgName?, duringStart?, afterStart? }` | project |
| GET | `/api/projects/:id` | | project + `sites[]` (each with `assetCounts`) + `totals { before, during, after, unknown, total, flagged, assets, verified }` + `unassignedAssets` |
| PATCH | `/api/projects/:id` | any of the create fields | project |
| DELETE | `/api/projects/:id` | | `{ deleted }` |
| GET | `/api/projects/:id/sites` | | sites |
| POST | `/api/projects/:id/sites` | `{ name, lat, lng, description?, radiusM? }` | site |
| GET | `/api/projects/:id/timeline` | | `[{ siteId, before[], during[], after[], unknown[] }]` oldest first |

`duringStart` / `afterStart` define phases: captured before `duringStart` = **before**, between = **during**, after `afterStart` = **after**.

## Field locations
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/locations?projectId=&siteId=&q=` | | named locations (each site gets a default one named after it) |
| POST | `/api/locations` | `{ projectId, siteId?, name, lat?, lng? }` | location |

A location is a reusable label inside a site for repeat photography of one spot. Ingest accepts `locationId`; without it an asset gets its site's default location. `npm run backfill:locations -- --project <slug>` creates defaults and attaches existing assets.

## Upload and ingest
1. `POST /api/uploads/sign` with `{ projectId, siteId? }` → `{ cloudName, apiKey, timestamp, signature, folder, params, uploadUrl }`.
2. Upload to `uploadUrl` as multipart form: `file`, `api_key`, `signature`, and **every key in `params` unchanged**. Or pass these to the Cloudinary Upload Widget as `uploadSignature`.
3. `POST /api/assets/ingest` with `{ projectId, publicIds: string[], siteId?, phase?, analyze? }` → `{ summary, results[] }`.

Ingest runs Cloudinary analysis (tags, caption, EXIF, phash, colours), fills missing captions/tags with the vision model when add-on quotas run out, assigns site by GPS proximity and phase by EXIF date, runs verification, and embeds for search. Re-ingesting the same `public_id` updates in place.

## Assets
| Method | Path | Query / body | Returns |
|---|---|---|---|
| GET | `/api/assets` | `projectId` (required), `siteId`, `phase`, `verified=true|false`, `from`, `to`, `limit`, `offset` | assets, newest first |
| GET | `/api/assets/:id` | | asset + `site` + `provenance { source, exif, ai, derivations[] }` |
| PATCH | `/api/assets/:id` | `{ siteId?, phase?, resetPhase?, verified? }` | asset |
| DELETE | `/api/assets/:id` | | `{ deleted }` |

Asset fields the UI will use: `secureUrl`, `cloudinaryPublicId`, `phase`, `capturedAt`, `lat`, `lng`, `siteId`, `aiTags[]`, `aiCaption`, `verified`, `flags[] { code, message, relatedAssetId? }`, `width`, `height`, `colors`.

Flag codes: `no_gps`, `no_capture_date` (informational), `far_from_site`, `no_site_match`, `future_date`, `duplicate`, `phase_order`. `verified` is false when a blocking flag is present; reports skip unverified assets by default.

## Before and after
| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/api/sites/:id/suggest-pair` | | `{ beforeAssetId, afterAssetId, strategy }` or `null` |
| POST | `/api/comparisons` | `{ beforeAssetId, afterAssetId, mode? }` | comparison (takes ~10–30 s) |
| GET | `/api/comparisons?projectId=&siteId=` | | comparisons, newest first |
| GET | `/api/comparisons/:id` | | comparison |
| DELETE | `/api/comparisons/:id` | | `{ deleted }` |

`mode` is `same_spot` (default: strict repeat photography, metrics only when the model agrees it is the same place) or `representative` (two photos standing for the site before and after, possibly different vantage points; metrics compare the depicted conditions and the UI must label it "representative"). Use `representative` when the team has no fixed-point pairs.

Comparison fields: `mode`, `beforeUrl`, `afterUrl` (same 1024×768 crop for the slider), `headline`, `summary`, `sameLocation`, `locationConfidence`, `metrics[] { name, direction, reason }` where name ∈ `vegetation_cover | waste_and_debris | water_clarity | human_activity | infrastructure` and direction ∈ `increased | decreased | unchanged | not_visible`.

## Search
`GET /api/search?q=plastic+waste+near+river&projectId=…&siteId=&locationId=&phase=&from=&to=&verifiedOnly=true&limit=30`
→ `{ mode: "hybrid" | "keyword", hits: [{ asset, score, matchedBy: ["semantic" | "keyword"] }] }`

`score` is a reciprocal-rank-fusion sum, useful for ordering only: its maximum is about 0.03, so it is not a percentage. The UI shows each hit relative to the best one. If the embedding provider is unavailable the search still answers, with keyword results.

## Reports
| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST | `/api/reports` | `{ projectId, title?, includeFlagged? }` | report metadata + `htmlUrl` (takes ~20–60 s) |
| GET | `/api/reports?projectId=` | | report list |
| GET | `/api/reports/:id` | | report `content` (structured), `campaignImageUrl`, `assetIds`, `comparisonIds`, `htmlUrl` |
| GET | `/api/reports/:id/html` | | self-contained HTML page (iframe it, or print to PDF) |
| GET | `/api/reports/:id/sources` | | original assets behind the report |
| DELETE | `/api/reports/:id` | | `{ deleted }` (source assets untouched) |

`content` shape: `{ title, executiveSummary, keyNumbers[{label,value}], sites[{siteId, siteName, narrative, assetCount, heroComparisonId?}], callToAction, generatedAt }`.

## Provenance
Every derived image (thumbnail, comparison crop, report hero, campaign image) is stored in `provenance` with the exact Cloudinary transformation string and the comparison/report it was made for. `GET /api/assets/:id` returns it all under `provenance.derivations`.
