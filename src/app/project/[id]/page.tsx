"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Image as ImageIcon,
  MapPin,
  Search,
  ShieldCheck,
  Waves,
} from "lucide-react";

type Site = {
  id: string;
  name: string;
  description?: string | null;
  assetCounts?: {
    total?: number;
    before?: number;
    during?: number;
    after?: number;
    unknown?: number;
  };
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
  sites?: Site[];
};

type Location = {
  id: string;
  projectId: string;
  siteId: string | null;
  name: string;
  lat: number | null;
  lng: number | null;
};

type Asset = {
  id: string;
  secureUrl: string;
  phase: "before" | "during" | "after" | "unknown";
  siteId: string | null;
  locationId: string | null;
  verified: boolean;
  createdAt?: string | null;
  capturedAt?: string | null;
  aiCaption?: string | null;
};

type Comparison = {
  id: string;
  siteId: string | null;
  beforeAssetId: string;
  afterAssetId: string;
  headline: string;
  summary: string;
  sameLocation: boolean;
  locationConfidence: number;
  metrics: {
    name: string;
    reason: string;
    direction: string;
  }[];
  model: string;
  mode: "same_spot" | "representative";
  beforeUrl: string;
  afterUrl: string;
};

export default function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();

  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;

    async function loadProject() {
      try {
        setLoading(true);
        setError("");

        const [
          projectResponse,
          assetsResponse,
          comparisonsResponse,
          locationsResponse,
        ] = await Promise.all([
          fetch(`/api/projects/${projectId}`, {
            cache: "no-store",
          }),

          fetch(
            `/api/assets?projectId=${encodeURIComponent(
              projectId
            )}&limit=500`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `/api/comparisons?projectId=${encodeURIComponent(
              projectId
            )}`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `/api/locations?projectId=${encodeURIComponent(
              projectId
            )}`,
            {
              cache: "no-store",
            }
          ),
        ]);

        const projectResult = await projectResponse.json();
        const assetsResult = await assetsResponse.json();
        const comparisonsResult =
          await comparisonsResponse.json();
        const locationsResult = await locationsResponse.json();

        if (!projectResponse.ok || !projectResult.ok) {
          throw new Error(
            projectResult.error ||
              "Unable to load project."
          );
        }

        setProject(projectResult.data);

        if (
          assetsResponse.ok &&
          assetsResult.ok &&
          Array.isArray(assetsResult.data)
        ) {
          setAssets(assetsResult.data);
        } else {
          setAssets([]);
        }

        if (
          comparisonsResponse.ok &&
          comparisonsResult.ok &&
          Array.isArray(comparisonsResult.data)
        ) {
          setComparisons(comparisonsResult.data);
        } else {
          setComparisons([]);
        }

        if (
          locationsResponse.ok &&
          locationsResult.ok &&
          Array.isArray(locationsResult.data)
        ) {
          setLocations(locationsResult.data);
        } else {
          setLocations([]);
        }
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load project."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [projectId]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error || !project) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] px-6 py-10 text-[#172019]">
        <div className="mx-auto max-w-[1280px]">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-10 flex items-center gap-2 text-sm text-muted-foreground hover:text-[#172019]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </button>

          <div className="border border-black/[0.08] bg-white p-10">
            <h1 className="text-2xl font-semibold">
              Project could not be loaded
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {error ||
                "The requested project was not found."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Calculate dashboard totals from the actual project
   * responses rather than relying on cached totals.
   */
  const totalAssets = assets.length;

  const verifiedAssets = assets.filter(
    (asset) => asset.verified
  ).length;

  const totalComparisons = comparisons.length;

  const totalSites = project.sites?.length ?? 0;

  const totalLocations = locations.length;

  /*
   * Show the newest evidence first.
   * capturedAt is preferred because it represents when
   * the photograph was actually taken.
   */
  const recentAssets = [...assets]
    .sort((a, b) => {
      const aDate = a.capturedAt || a.createdAt || "";
      const bDate = b.capturedAt || b.createdAt || "";

      return (
        new Date(bDate).getTime() -
        new Date(aDate).getTime()
      );
    })
    .slice(0, 8);

  /*
   * Count assets belonging to each persistent location.
   * Older demo assets without locationId are still
   * represented through their site.
   */
  const getLocationAssetCount = (
    location: Location
  ) => {
    return assets.filter((asset) => {
      if (asset.locationId === location.id) {
        return true;
      }

      if (
        location.siteId &&
        asset.siteId === location.siteId &&
        !asset.locationId
      ) {
        return true;
      }

      return false;
    }).length;
  };

  /*
   * Locations without an asset count are still useful,
   * but put active evidence locations first.
   */
  const orderedLocations = [...locations].sort(
    (a, b) => {
      const aCount = getLocationAssetCount(a);
      const bCount = getLocationAssetCount(b);

      return bCount - aCount;
    }
  );

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#172019]">
      {/* Header */}
      <header className="border-b border-black/[0.07] bg-[#f7f8f6]">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#172019] text-white">
              <span className="text-sm font-semibold">
                F
              </span>
            </div>

            <div className="text-left">
              <p className="text-[15px] font-semibold tracking-[-0.02em]">
                FieldProof
              </p>

              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Field evidence
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-[#172019]"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </button>
        </div>
      </header>

      {/* Project heading */}
      <section className="mx-auto max-w-[1440px] px-6 pb-10 pt-12 lg:px-10 lg:pt-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Project overview
            </p>

            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
              {project.name}
            </h1>

            {project.description && (
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active project
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-[1440px] px-6 pb-12 lg:px-10">
        <div className="grid border-y border-black/[0.08] bg-white sm:grid-cols-2 lg:grid-cols-4">
          <StatBlock
            icon={<ImageIcon className="h-4 w-4" />}
            value={totalAssets}
            label="Evidence assets"
          />

          <StatBlock
            icon={<MapPin className="h-4 w-4" />}
            value={totalLocations || totalSites}
            label={
              totalLocations
                ? "Field locations"
                : "Field sites"
            }
            bordered
          />

          <StatBlock
            icon={<ShieldCheck className="h-4 w-4" />}
            value={verifiedAssets}
            label="Verified assets"
            bordered
          />

          <StatBlock
            icon={<Waves className="h-4 w-4" />}
            value={totalComparisons}
            label="Comparisons"
            bordered
          />
        </div>
      </section>

      {/* Navigation */}
      <section className="mx-auto max-w-[1440px] px-6 pb-12 lg:px-10">
        <div className="flex flex-wrap gap-2 border-b border-black/[0.08] pb-3">
          <DashboardLink
            href={`/gallery?projectId=${projectId}`}
            icon={<ImageIcon className="h-4 w-4" />}
            label="Gallery"
          />

          <DashboardLink
            href={`/comparison?projectId=${projectId}`}
            icon={<Waves className="h-4 w-4" />}
            label="Comparison"
          />

          <DashboardLink
            href={`/search?projectId=${projectId}`}
            icon={<Search className="h-4 w-4" />}
            label="Search"
          />

          <DashboardLink
            href={`/report?projectId=${projectId}`}
            icon={<FileText className="h-4 w-4" />}
            label="Reports"
          />
        </div>
      </section>

      {/* Main content */}
      <section className="mx-auto max-w-[1440px] px-6 pb-20 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          {/* Recent evidence */}
          <div className="border border-black/[0.08] bg-white">
            <div className="flex items-center justify-between border-b border-black/[0.07] px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Recent evidence
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
                  Latest field photographs
                </h2>
              </div>

              <Link
                href={`/gallery?projectId=${projectId}`}
                className="flex items-center gap-1.5 text-sm font-medium text-[#314238] hover:underline"
              >
                View gallery
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentAssets.length > 0 ? (
              <div className="grid grid-cols-2 gap-px bg-black/[0.07] sm:grid-cols-4">
                {recentAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={`/gallery?asset=${asset.id}&projectId=${projectId}`}
                    className="group relative aspect-square overflow-hidden bg-[#e9ece8]"
                  >
                    <img
                      src={asset.secureUrl}
                      alt={
                        asset.aiCaption ||
                        "Field evidence"
                      }
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8">
                      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                        <span>{asset.phase}</span>

                        {asset.verified && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<ImageIcon className="h-5 w-5" />}
                title="No evidence yet"
                description="Photographs added to this project will appear here."
              />
            )}
          </div>

          {/* Field locations */}
          <div className="border border-black/[0.08] bg-white">
            <div className="flex items-start justify-between border-b border-black/[0.07] px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Field locations
                </p>

                <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
                  Evidence locations
                </h2>
              </div>

              <span className="text-xs text-muted-foreground">
                {totalLocations}{" "}
                {totalLocations === 1
                  ? "location"
                  : "locations"}
              </span>
            </div>

            {orderedLocations.length > 0 ? (
              <div className="divide-y divide-black/[0.07]">
                {orderedLocations.slice(0, 6).map(
                  (location) => {
                    const locationAssets =
                      getLocationAssetCount(location);

                    const site = project.sites?.find(
                      (item) =>
                        item.id === location.siteId
                    );

                    return (
                      <Link
                        key={location.id}
                        href={`/gallery?projectId=${projectId}&locationId=${location.id}`}
                        className="block px-6 py-5 transition-colors hover:bg-[#fafbf9]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f3ef] text-[#526158]">
                            <MapPin className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-sm font-semibold">
                                {location.name}
                              </h3>

                              <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </div>

                            {site && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {site.name}
                              </p>
                            )}

                            <p className="mt-2 text-xs text-muted-foreground">
                              {locationAssets}{" "}
                              {locationAssets === 1
                                ? "asset"
                                : "assets"}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  }
                )}

                {orderedLocations.length > 6 && (
                  <Link
                    href={`/gallery?projectId=${projectId}`}
                    className="block px-6 py-4 text-center text-xs font-medium text-[#314238] hover:bg-[#fafbf9]"
                  >
                    View all field locations →
                  </Link>
                )}
              </div>
            ) : project.sites &&
              project.sites.length > 0 ? (
              /*
               * Fallback for projects that have sites but
               * have not created named locations yet.
               */
              <div className="divide-y divide-black/[0.07]">
                {project.sites.map((site) => {
                  const siteAssets = assets.filter(
                    (asset) => asset.siteId === site.id
                  ).length;

                  return (
                    <div
                      key={site.id}
                      className="px-6 py-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f0f3ef] text-[#526158]">
                          <MapPin className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold">
                            {site.name}
                          </h3>

                          {site.description && (
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {site.description}
                            </p>
                          )}

                          <p className="mt-2 text-xs text-muted-foreground">
                            {siteAssets}{" "}
                            {siteAssets === 1
                              ? "asset"
                              : "assets"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<MapPin className="h-5 w-5" />}
                title="No field locations yet"
                description="Named field locations will appear here when evidence is assigned to them."
              />
            )}
          </div>
        </div>

        {/* Evidence breakdown */}
        <div className="mt-6 border border-black/[0.08] bg-white">
          <div className="border-b border-black/[0.07] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Evidence breakdown
            </p>

            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
              Evidence across project phases
            </h2>
          </div>

          <div className="grid divide-y divide-black/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <PhaseBlock
              label="Before"
              count={
                assets.filter(
                  (asset) => asset.phase === "before"
                ).length
              }
            />

            <PhaseBlock
              label="During"
              count={
                assets.filter(
                  (asset) => asset.phase === "during"
                ).length
              }
            />

            <PhaseBlock
              label="After"
              count={
                assets.filter(
                  (asset) => asset.phase === "after"
                ).length
              }
            />

            <PhaseBlock
              label="Unknown"
              count={
                assets.filter(
                  (asset) => asset.phase === "unknown"
                ).length
              }
            />
          </div>
        </div>

        {/* Workflow */}
        <div className="mt-6 border border-black/[0.08] bg-white">
          <div className="border-b border-black/[0.07] px-6 py-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Project workflow
            </p>

            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em]">
              Work with this project
            </h2>
          </div>

          <div className="grid divide-y divide-black/[0.07] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            <WorkflowItem
              href={`/gallery?projectId=${projectId}`}
              icon={<ImageIcon className="h-4 w-4" />}
              number="01"
              title="Browse evidence"
              description="Review photographs by site, location, phase and verification status."
            />

            <WorkflowItem
              href={`/comparison?projectId=${projectId}`}
              icon={<Waves className="h-4 w-4" />}
              number="02"
              title="Compare change"
              description="Review before and after evidence and AI findings."
            />

            <WorkflowItem
              href={`/search?projectId=${projectId}`}
              icon={<Search className="h-4 w-4" />}
              number="03"
              title="Search evidence"
              description="Find relevant field records using natural language and field locations."
            />

            <WorkflowItem
              href={`/report?projectId=${projectId}`}
              icon={<FileText className="h-4 w-4" />}
              number="04"
              title="Prepare reports"
              description="Turn the project's evidence into an impact report."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.07]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-8 text-xs text-muted-foreground lg:px-10">
          <span>FieldProof</span>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="hover:text-[#172019]"
          >
            Back to projects
          </button>
        </div>
      </footer>
    </main>
  );
}

function StatBlock({
  icon,
  value,
  label,
  bordered = false,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={`px-6 py-5 ${
        bordered
          ? "border-t border-black/[0.07] sm:border-l sm:border-t-0"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}

        <span className="text-xs uppercase tracking-[0.1em]">
          {label}
        </span>
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
        {value}
      </p>
    </div>
  );
}

function PhaseBlock({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div className="px-6 py-5">
      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>

      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]">
        {count}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {count === 1 ? "asset" : "assets"}
      </p>
    </div>
  );
}

function DashboardLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-black/[0.1] bg-white px-4 py-2 text-sm font-medium text-[#314238] transition-colors hover:border-black/[0.2] hover:bg-[#172019] hover:text-white"
    >
      {icon}
      {label}
    </Link>
  );
}

function WorkflowItem({
  href,
  icon,
  number,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group p-6 transition-colors hover:bg-[#fafbf9]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-[0.12em] text-muted-foreground">
          {number}
        </span>

        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.09] transition-colors group-hover:border-[#172019] group-hover:bg-[#172019] group-hover:text-white">
          {icon}
        </span>
      </div>

      <h3 className="mt-6 text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {description}
      </p>

      <div className="mt-5 flex items-center gap-1 text-xs font-medium text-[#314238]">
        Open
        <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0f3ef] text-[#526158]">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-screen bg-[#f7f8f6]">
      <header className="h-[72px] border-b border-black/[0.07]" />

      <div className="mx-auto max-w-[1440px] animate-pulse px-6 py-16 lg:px-10">
        <div className="h-4 w-28 bg-[#e6e9e5]" />

        <div className="mt-5 h-12 w-2/3 bg-[#e6e9e5]" />

        <div className="mt-4 h-5 w-1/2 bg-[#e6e9e5]" />

        <div className="mt-12 grid grid-cols-2 border-y border-black/[0.07] lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 border-black/[0.07] p-6"
            >
              <div className="h-4 w-20 bg-[#e6e9e5]" />
              <div className="mt-5 h-8 w-14 bg-[#e6e9e5]" />
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="h-[400px] bg-[#e6e9e5]" />
          <div className="h-[400px] bg-[#e6e9e5]" />
        </div>
      </div>
    </main>
  );
}