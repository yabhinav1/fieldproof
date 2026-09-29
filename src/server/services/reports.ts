import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db";
import { assets, comparisons, provenance, reports, sites, type Comparison, type ReportContent } from "../db/schema";
import { TRANSFORMS, campaignImageUrl, derivedUrl } from "../cloudinary";
import { writeNarrative, type NarrativeFacts } from "../ai/narrative";
import { notFound } from "../http";
import { getProject } from "./projects";
import { renderReportHtml, type ReportRenderData } from "./report-html";

export const CreateReportSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2).max(160).optional(),
  /** Include assets that failed verification. Default false: reports are evidence. */
  includeFlagged: z.boolean().default(false),
});

/**
 * Generates an impact report:
 * 1. Gathers verified assets, per-site tag/caption evidence and the latest comparison per site.
 * 2. Asks the model for a grounded narrative.
 * 3. Builds the campaign image via Cloudinary overlays and renders HTML.
 * 4. Records every derived image in provenance, keyed to this report.
 */
export async function createReport(db: Database, input: z.infer<typeof CreateReportSchema>) {
  const project = await getProject(db, input.projectId);
  const siteRows = await db.select().from(sites).where(eq(sites.projectId, project.id)).orderBy(sites.createdAt);

  const assetRows = await db
    .select()
    .from(assets)
    .where(input.includeFlagged ? eq(assets.projectId, project.id) : and(eq(assets.projectId, project.id), eq(assets.verified, true)))
    .orderBy(assets.capturedAt);

  const allComparisons = await db
    .select()
    .from(comparisons)
    .where(eq(comparisons.projectId, project.id))
    .orderBy(desc(comparisons.generatedAt));

  // Latest usable comparison per site: a same-spot pair the model accepted, or a representative pair.
  const latestBySite = new Map<string, Comparison>();
  for (const c of allComparisons) {
    const usable = c.mode === "representative" || c.sameLocation !== false;
    if (c.siteId && usable && !latestBySite.has(c.siteId)) latestBySite.set(c.siteId, c);
  }

  const dated = assetRows.filter((a) => a.capturedAt).map((a) => a.capturedAt!.getTime());
  const [flagged] = await db
    .select({ n: count() })
    .from(assets)
    .where(and(eq(assets.projectId, project.id), eq(assets.verified, false)));
  const flaggedCount = Number(flagged?.n ?? 0);

  const facts: NarrativeFacts = {
    project: { name: project.name, description: project.description, orgName: project.orgName },
    period: {
      from: dated.length ? new Date(Math.min(...dated)).toISOString().slice(0, 10) : null,
      to: dated.length ? new Date(Math.max(...dated)).toISOString().slice(0, 10) : null,
    },
    totals: {
      assets: assetRows.length,
      verified: assetRows.filter((a) => a.verified).length,
      flagged: flaggedCount,
      sites: siteRows.length,
      comparisons: latestBySite.size,
    },
    sites: siteRows.map((s) => {
      const mine = assetRows.filter((a) => a.siteId === s.id);
      const counts = { before: 0, during: 0, after: 0, unknown: 0 };
      const tagFreq = new Map<string, number>();
      for (const a of mine) {
        counts[a.phase]++;
        for (const t of a.aiTags) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
      }
      const cmp = latestBySite.get(s.id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        assetCounts: counts,
        topTags: [...tagFreq.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([t]) => t),
        sampleCaptions: mine
          .map((a) => a.aiCaption)
          .filter((c): c is string => Boolean(c))
          .slice(0, 6),
        comparison: cmp
          ? { headline: cmp.headline, summary: cmp.summary, metrics: cmp.metrics, mode: cmp.mode }
          : null,
      };
    }),
  };

  const { result: narrative, model } = await writeNarrative(facts);

  // Hero image: prefer the "after" photo from the first comparison, else the latest verified asset.
  const heroComparison = [...latestBySite.values()][0];
  const heroAsset =
    (heroComparison && assetRows.find((a) => a.id === heroComparison.afterAssetId)) ??
    [...assetRows].reverse().find((a) => a.phase === "after") ??
    assetRows[assetRows.length - 1];

  const campaign = heroAsset
    ? campaignImageUrl(heroAsset.cloudinaryPublicId, narrative.campaign_headline, project.orgName ?? project.name)
    : null;
  const heroDerived = heroAsset ? derivedUrl(heroAsset.cloudinaryPublicId, TRANSFORMS.reportHero) : null;

  const content: ReportContent = {
    title: input.title ?? narrative.title,
    executiveSummary: narrative.executive_summary,
    keyNumbers: narrative.key_numbers,
    sites: siteRows.map((s) => ({
      siteId: s.id,
      siteName: s.name,
      narrative: narrative.sites.find((n) => n.site_id === s.id)?.narrative ?? "",
      assetCount: assetRows.filter((a) => a.siteId === s.id).length,
      heroComparisonId: latestBySite.get(s.id)?.id,
    })),
    callToAction: narrative.call_to_action,
    generatedAt: new Date().toISOString(),
  };

  const renderData: ReportRenderData = {
    project: { name: project.name, orgName: project.orgName, description: project.description },
    content,
    heroUrl: heroDerived?.url ?? null,
    campaignImageUrl: campaign?.url ?? null,
    sites: siteRows.map((s) => {
      const cmp = latestBySite.get(s.id);
      const mine = assetRows.filter((a) => a.siteId === s.id);
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        comparison: cmp
          ? { beforeUrl: cmp.beforeUrl, afterUrl: cmp.afterUrl, headline: cmp.headline, summary: cmp.summary, metrics: cmp.metrics, mode: cmp.mode }
          : null,
        gallery: mine.slice(-6).map((a) => ({
          id: a.id,
          url: derivedUrl(a.cloudinaryPublicId, TRANSFORMS.thumbnail).url,
          caption: a.aiCaption,
          phase: a.phase,
          capturedAt: a.capturedAt?.toISOString() ?? null,
          publicId: a.cloudinaryPublicId,
        })),
      };
    }),
    period: facts.period,
    totals: facts.totals,
  };

  const html = renderReportHtml(renderData);

  const [row] = await db
    .insert(reports)
    .values({
      projectId: project.id,
      title: content.title,
      content,
      html,
      campaignImageUrl: campaign?.url ?? null,
      assetIds: assetRows.map((a) => a.id),
      comparisonIds: [...latestBySite.values()].map((c) => c.id),
      model,
    })
    .returning();

  // Provenance for every derived image this report introduced.
  const provRows: (typeof provenance.$inferInsert)[] = [];
  if (heroAsset && heroDerived) {
    provRows.push({ assetId: heroAsset.id, purpose: "report", derivedUrl: heroDerived.url, transformation: heroDerived.transformation, referenceType: "report", referenceId: row.id });
  }
  if (heroAsset && campaign) {
    provRows.push({ assetId: heroAsset.id, purpose: "campaign", derivedUrl: campaign.url, transformation: campaign.transformation, referenceType: "report", referenceId: row.id });
  }
  for (const s of renderData.sites) {
    for (const g of s.gallery) {
      provRows.push({ assetId: g.id, purpose: "report", derivedUrl: g.url, transformation: TRANSFORMS.thumbnail, referenceType: "report", referenceId: row.id });
    }
  }
  if (provRows.length) await db.insert(provenance).values(provRows);

  return row;
}

export async function getReport(db: Database, id: string) {
  const row = await db.query.reports.findFirst({ where: eq(reports.id, id) });
  if (!row) throw notFound("Report");
  return row;
}

export async function deleteReport(db: Database, id: string) {
  await getReport(db, id);
  await db.delete(provenance).where(and(eq(provenance.referenceType, "report"), eq(provenance.referenceId, id)));
  await db.delete(reports).where(eq(reports.id, id));
}

export async function listReports(db: Database, projectId: string) {
  const rows = await db
    .select({
      id: reports.id,
      projectId: reports.projectId,
      title: reports.title,
      campaignImageUrl: reports.campaignImageUrl,
      createdAt: reports.createdAt,
      model: reports.model,
    })
    .from(reports)
    .where(eq(reports.projectId, projectId))
    .orderBy(desc(reports.createdAt));
  return rows;
}

/** Source assets for a report, for the "evidence" appendix and traceability. */
export async function reportSources(db: Database, id: string) {
  const report = await getReport(db, id);
  if (!report.assetIds.length) return [];
  return db
    .select({ id: assets.id, cloudinaryPublicId: assets.cloudinaryPublicId, secureUrl: assets.secureUrl, siteId: assets.siteId, phase: assets.phase, capturedAt: assets.capturedAt })
    .from(assets)
    .where(inArray(assets.id, report.assetIds));
}
