import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type Database } from "@/server/db";
import { eq } from "drizzle-orm";
import { assets, comparisons, provenance } from "@/server/db/schema";
import { createLocation } from "@/server/services/locations";
import { createProject, createSite, getProjectOverview, listProjects, updateProject } from "@/server/services/projects";
import { ingestResource } from "@/server/services/ingest";
import { ListAssetsQuery, getAssetDetail, listAssets, updateAsset, assetTimeline } from "@/server/services/assets";
import { SearchQuery, searchAssets } from "@/server/services/search";
import { deleteComparison, suggestPair } from "@/server/services/comparisons";
import { renderReportHtml } from "@/server/services/report-html";
import type { CloudinaryResource } from "@/server/cloudinary";

let db: Database;
let close: () => Promise<void>;

beforeAll(async () => {
  const h = await createDatabase({ dataDir: "memory://" });
  db = h.db;
  close = h.close;
});
afterAll(async () => {
  await close();
});

const SITE_A = { lat: 28.6139, lng: 77.209 }; // "ghat cleanup"
const SITE_B = { lat: 28.7041, lng: 77.1025 }; // ~14 km away

function resource(overrides: Partial<CloudinaryResource> & { public_id: string }): CloudinaryResource {
  return {
    resource_type: "image",
    secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${overrides.public_id}.jpg`,
    format: "jpg",
    width: 4000,
    height: 3000,
    bytes: 1_000_000,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("projects and sites", () => {
  it("creates a project with a derived slug and sites", async () => {
    const p = await createProject(db, {
      name: "Green Yamuna Collective — Riverbank Restoration",
      orgName: "Green Yamuna Collective",
      duringStart: new Date("2026-03-01"),
      afterStart: new Date("2026-06-01"),
    });
    expect(p.slug).toBe("green-yamuna-collective-riverbank-restoration");

    const a = await createSite(db, p.id, { name: "Site A · Ghat cleanup", ...SITE_A, radiusM: 1500 });
    const b = await createSite(db, p.id, { name: "Site B · Tree plantation", ...SITE_B });
    expect(a.radiusM).toBe(1500);
    expect(b.radiusM).toBe(2000);

    const list = await listProjects(db);
    expect(list.find((x) => x.id === p.id)?.siteCount).toBe(2);
  });
});

describe("ingest", () => {
  let projectId: string;
  let siteAId: string;
  let siteBId: string;
  let siteRows: Awaited<ReturnType<typeof import("@/server/services/projects").listSites>>;
  const project = { duringStart: new Date("2026-03-01"), afterStart: new Date("2026-06-01") };

  beforeAll(async () => {
    const p = await createProject(db, { name: "Ingest test", slug: "ingest-test", ...project });
    projectId = p.id;
    siteAId = (await createSite(db, p.id, { name: "A", ...SITE_A })).id;
    siteBId = (await createSite(db, p.id, { name: "B", ...SITE_B })).id;
    const { listSites } = await import("@/server/services/projects");
    siteRows = await listSites(db, p.id);
  });

  it("assigns site from GPS and phase from EXIF date, and records a thumbnail derivation", async () => {
    const r = await ingestResource(db, {
      resource: resource({
        public_id: "fieldproof/ingest-test/a-before",
        phash: "8f3c1e0f0f0f0f0f",
        image_metadata: {
          DateTimeOriginal: "2026:01:15 09:30:00",
          GPSLatitude: `28 deg 36' 50.04" N`,
          GPSLatitudeRef: "North",
          GPSLongitude: `77 deg 12' 32.40" E`,
          GPSLongitudeRef: "East",
        },
        info: {
          categorization: { google_tagging: { data: [{ tag: "River", confidence: 0.9 }, { tag: "Litter", confidence: 0.8 }] } },
          detection: { captioning: { data: { caption: "Plastic waste piled along a river bank" } } },
        },
      }),
      project: { id: projectId, ...project },
      siteRows,
    });

    expect(r.status).toBe("created");
    expect(r.siteId).toBe(siteAId);
    expect(r.phase).toBe("before");
    expect(r.flags).toEqual([]);

    const detail = await getAssetDetail(db, r.assetId!);
    expect(detail.aiTags).toEqual(["river", "litter"]);
    expect(detail.aiCaption).toContain("Plastic waste");
    expect(detail.verified).toBe(true);
    expect(detail.provenance.derivations).toHaveLength(1);
    expect(detail.provenance.derivations[0].purpose).toBe("thumbnail");
    expect(detail.provenance.derivations[0].derivedUrl).toContain("c_fill,g_auto,w_400,h_300");
    expect(detail.provenance.source.cloudinaryPublicId).toBe("fieldproof/ingest-test/a-before");
  });

  it("flags near-duplicates and leaves GPS-less photos unassigned", async () => {
    const dup = await ingestResource(db, {
      resource: resource({
        public_id: "fieldproof/ingest-test/a-before-copy",
        phash: "8f3c1e0f0f0f0f0e",
        image_metadata: { DateTimeOriginal: "2026:01:15 09:31:00" },
      }),
      project: { id: projectId, ...project },
      siteRows,
    });
    expect(dup.siteId).toBeNull();
    expect(dup.flags?.map((f) => f.code).sort()).toEqual(["duplicate", "no_gps"]);
    const detail = await getAssetDetail(db, dup.assetId!);
    expect(detail.verified).toBe(false);
  });

  it("uses overrides, is idempotent per public_id, and builds the timeline", async () => {
    const first = await ingestResource(db, {
      resource: resource({
        public_id: "fieldproof/ingest-test/b-after",
        phash: "0000000000000001",
        image_metadata: { DateTimeOriginal: "2026:08:20 16:00:00", GPSLatitude: "28.7041", GPSLongitude: "77.1025" },
      }),
      project: { id: projectId, ...project },
      siteRows,
    });
    expect(first.siteId).toBe(siteBId);
    expect(first.phase).toBe("after");

    const again = await ingestResource(db, {
      resource: resource({
        public_id: "fieldproof/ingest-test/b-after",
        phash: "0000000000000001",
        image_metadata: { DateTimeOriginal: "2026:08:20 16:00:00", GPSLatitude: "28.7041", GPSLongitude: "77.1025" },
      }),
      project: { id: projectId, ...project },
      siteRows,
      phaseOverride: "during",
    });
    expect(again.status).toBe("updated");
    expect(again.assetId).toBe(first.assetId);
    expect(again.phase).toBe("during");

    const all = await listAssets(db, { projectId, limit: 200, offset: 0 });
    expect(all).toHaveLength(3);
    expect(all.every((a) => !("cloudinaryRaw" in a) && !("embedding" in a))).toBe(true);

    const timeline = await assetTimeline(db, projectId);
    const siteB = timeline.find((t) => t.siteId === siteBId);
    expect(siteB?.during).toHaveLength(1);

    const overview = await getProjectOverview(db, projectId);
    expect(overview.totals.total).toBe(3);
    expect(overview.totals.flagged).toBe(1);
    expect(overview.unassignedAssets.total).toBe(1);
  });

  it("supports manual corrections and phase reset", async () => {
    const all = await listAssets(db, { projectId, limit: 200, offset: 0 });
    const orphan = all.find((a) => a.siteId === null)!;
    const fixed = await updateAsset(db, orphan.id, { siteId: siteAId, verified: true });
    expect(fixed.siteId).toBe(siteAId);
    expect(fixed.siteOverridden).toBe(true);
    expect(fixed.verified).toBe(true);

    const b = all.find((a) => a.cloudinaryPublicId.endsWith("b-after"))!;
    const reset = await updateAsset(db, b.id, { resetPhase: true });
    expect(reset.phase).toBe("after");
    expect(reset.phaseOverridden).toBe(false);
  });

  it("keyword search works with no embedding provider configured", async () => {
    const res = await searchAssets(db, { q: "plastic waste river", projectId, limit: 30 });
    expect(res.mode).toBe("keyword");
    expect(res.hits.length).toBeGreaterThanOrEqual(1);
    expect(res.hits[0].asset.cloudinaryPublicId).toBe("fieldproof/ingest-test/a-before");
    expect(res.hits[0].matchedBy).toContain("keyword");

    const filtered = await searchAssets(db, { q: "river", projectId, siteId: siteBId, limit: 30 });
    expect(filtered.hits).toHaveLength(0);
  });

  it("suggests a before/after pair per site", async () => {
    // Site A now has: a-before (before, verified) and the corrected duplicate (before, verified).
    // Add a verified after photo so the phase strategy applies.
    await ingestResource(db, {
      resource: resource({
        public_id: "fieldproof/ingest-test/a-after",
        phash: "ffff0000ffff0000",
        image_metadata: { DateTimeOriginal: "2026:09:01 10:00:00", GPSLatitude: "28.6139", GPSLongitude: "77.209" },
      }),
      project: { id: projectId, ...project },
      siteRows,
    });
    const pair = await suggestPair(db, siteAId);
    expect(pair?.strategy).toBe("phase");
    const before = await getAssetDetail(db, pair!.beforeAssetId);
    const after = await getAssetDetail(db, pair!.afterAssetId);
    expect(before.phase).toBe("before");
    expect(after.phase).toBe("after");
  });

  it("treats a bare `to` date as the end of that day", async () => {
    // a-after was captured 2026-09-01 10:00 UTC, so a range ending on that date must include it.
    const q = ListAssetsQuery.parse({ projectId, from: "2026-09-01", to: "2026-09-01" });
    const listed = await listAssets(db, q);
    expect(listed.map((a) => a.cloudinaryPublicId)).toEqual(["fieldproof/ingest-test/a-after"]);

    const s = SearchQuery.parse({ q: "site", projectId, from: "2026-09-01", to: "2026-09-01" });
    expect(s.to?.toISOString()).toBe("2026-09-01T23:59:59.999Z");
    expect(() => SearchQuery.parse({ q: "site", projectId, to: "not-a-date" })).toThrow();
  });

  it("filters search by field location on the server, including legacy assets at its site", async () => {
    const north = await createLocation(db, { projectId, siteId: siteAId, name: "North bank" });
    const south = await createLocation(db, { projectId, siteId: siteAId, name: "South bank" });

    // a-before moves to South bank; everything else at site A still has no location.
    const all = await listAssets(db, { projectId, limit: 200, offset: 0 });
    const aBefore = all.find((a) => a.cloudinaryPublicId.endsWith("/a-before"))!;
    await db.update(assets).set({ locationId: south.id }).where(eq(assets.id, aBefore.id));

    const atSouth = await searchAssets(db, { q: "plastic waste", projectId, locationId: south.id, limit: 30 });
    expect(atSouth.hits.map((h) => h.asset.id)).toEqual([aBefore.id]);

    // North bank must not pick up a photo that belongs to South bank just because they share a site.
    const atNorth = await searchAssets(db, { q: "plastic waste", projectId, locationId: north.id, limit: 30 });
    expect(atNorth.hits.map((h) => h.asset.id)).not.toContain(aBefore.id);

    const other = await createProject(db, { name: "Elsewhere", slug: "elsewhere" });
    await expect(searchAssets(db, { q: "river", projectId: other.id, locationId: north.id, limit: 30 })).rejects.toMatchObject({ status: 400 });
  });

  it("removes a comparison's provenance rows when the comparison is deleted", async () => {
    const pair = (await suggestPair(db, siteAId))!;
    const [cmp] = await db
      .insert(comparisons)
      .values({ projectId, siteId: siteAId, beforeAssetId: pair.beforeAssetId, afterAssetId: pair.afterAssetId, beforeUrl: "https://b", afterUrl: "https://a" })
      .returning();
    await db.insert(provenance).values({
      assetId: pair.beforeAssetId,
      purpose: "comparison",
      derivedUrl: "https://b",
      transformation: "c_fill",
      referenceType: "comparison",
      referenceId: cmp.id,
    });

    const before = await getAssetDetail(db, pair.beforeAssetId);
    expect(before.provenance.derivations.map((d) => d.purpose)).toEqual(["thumbnail", "comparison"]);

    await deleteComparison(db, cmp.id);
    const after = await getAssetDetail(db, pair.beforeAssetId);
    expect(after.provenance.derivations.map((d) => d.purpose)).toEqual(["thumbnail"]);
  });
});

describe("project updates", () => {
  it("accepts an empty patch, and checks phase boundaries against the stored values", async () => {
    const p = await createProject(db, { name: "Patch test", slug: "patch-test", duringStart: new Date("2026-03-01"), afterStart: new Date("2026-06-01") });

    expect((await updateProject(db, p.id, {})).name).toBe("Patch test");
    expect((await updateProject(db, p.id, { orgName: "Org" })).orgName).toBe("Org");

    // afterStart alone is valid on its own, but not against the stored duringStart.
    await expect(updateProject(db, p.id, { afterStart: new Date("2026-01-01") })).rejects.toMatchObject({ status: 400 });
  });
});

describe("report html", () => {
  it("renders escaped, self-contained HTML", () => {
    const html = renderReportHtml({
      project: { name: "P <script>", orgName: "Org", description: null },
      content: {
        title: "Title & co",
        executiveSummary: "Summary",
        keyNumbers: [{ label: "Photos", value: "12" }],
        sites: [{ siteId: "s1", siteName: "S1", narrative: "N", assetCount: 1 }],
        callToAction: "Help",
        generatedAt: "2026-09-25T10:00:00.000Z",
      },
      heroUrl: null,
      campaignImageUrl: null,
      period: { from: "2026-01-01", to: "2026-09-01" },
      totals: { assets: 1, verified: 1, flagged: 0, sites: 1, comparisons: 0 },
      sites: [{ id: "s1", name: "S1", lat: 1, lng: 2, comparison: null, gallery: [] }],
    });
    expect(html).toContain("Title &amp; co");
    expect(html).toContain("P &lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).toContain("No before/after comparison");
  });
});
