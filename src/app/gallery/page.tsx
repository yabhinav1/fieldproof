"use client";

import { useEffect, useState, type ReactNode } from "react";

type Project = {
    id: string;
    name: string;
    description?: string | null;
};

type Site = {
    id: string;
    name: string;
    description?: string | null;
};

type Asset = {
    id: string;
    projectId: string;
    siteId: string | null;
    secureUrl: string;
    cloudinaryPublicId?: string | null;
    createdAt?: string | null;
    exif?: Record<string, unknown> | null;
    format: string | null;
    width: number | null;
    height: number | null;
    phase: "before" | "during" | "after" | "unknown";
    capturedAt: string | null;
    aiTags: string[];
    aiCaption: string | null;
    verified: boolean;
    lat: number | null;
    lng: number | null;
    flags: unknown[];
    hasEmbedding: boolean;
};

const phaseOptions = ["all", "before", "during", "after", "unknown"] as const;

export default function GalleryPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState("");

    const [assets, setAssets] = useState<Asset[]>([]);
    const [sites, setSites] = useState<Site[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [error, setError] = useState("");

    const [phase, setPhase] =
        useState<(typeof phaseOptions)[number]>("all");

    const [verification, setVerification] = useState("all");

    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [assetDetails, setAssetDetails] = useState<Asset | null>(null);
    const [loadingAssetDetails, setLoadingAssetDetails] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadProjects() {
            try {
                setLoadingProjects(true);
                setError("");

                const response = await fetch("/api/projects");

                if (!response.ok) {
                    throw new Error("Failed to load projects");
                }

                const result = await response.json();

                if (!cancelled) {
                    const data: Project[] = result.data ?? [];
                    setProjects(data);

                    if (data.length > 0) {
                        setSelectedProject(data[0].id);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load projects"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingProjects(false);
                }
            }
        }

        loadProjects();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selectedProject) {
            setSites([]);
            return;
        }

        let cancelled = false;

        async function loadSites() {
            try {
                const response = await fetch(`/api/projects/${selectedProject}`);

                if (!response.ok) {
                    throw new Error("Failed to load project details");
                }

                const result = await response.json();

                if (!cancelled) {
                    setSites(result.data?.sites ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setSites([]);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load project details"
                    );
                }
            }
        }

        loadSites();

        return () => {
            cancelled = true;
        };
    }, [selectedProject]);

    useEffect(() => {
        if (!selectedProject) {
            setAssets([]);
            return;
        }

        let cancelled = false;

        async function loadAssets() {
            try {
                setLoadingAssets(true);
                setError("");

                const params = new URLSearchParams({
                    projectId: selectedProject,
                });

                if (phase !== "all") {
                    params.set("phase", phase);
                }

                if (verification !== "all") {
                    params.set("verified", verification);
                }

                const response = await fetch(`/api/assets?${params.toString()}`);

                if (!response.ok) {
                    throw new Error("Failed to load assets");
                }

                const result = await response.json();

                if (!cancelled) {
                    setAssets(result.data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setAssets([]);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load assets"
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingAssets(false);
                }
            }
        }

        loadAssets();

        return () => {
            cancelled = true;
        };
    }, [selectedProject, phase, verification]);

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <section className="border-b bg-background">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-foreground" />
                                <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    Evidence library
                                </span>
                            </div>

                            <h1 className="text-4xl font-semibold tracking-tight">
                                Field Gallery
                            </h1>

                            <p className="mt-3 text-base leading-7 text-muted-foreground">
                                Browse field evidence across sites, inspect verification status,
                                and trace changes through each project phase.
                            </p>
                        </div>

                        <div className="w-full lg:w-80">
                            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Active project
                            </label>

                            <select
                                value={selectedProject}
                                onChange={(event) => setSelectedProject(event.target.value)}
                                disabled={loadingProjects || projects.length === 0}
                                className="h-11 w-full rounded-lg border bg-background px-3.5 text-sm font-medium outline-none transition focus:ring-2 focus:ring-ring"
                            >
                                {loadingProjects ? (
                                    <option>Loading projects...</option>
                                ) : projects.length === 0 ? (
                                    <option>No projects found</option>
                                ) : (
                                    projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                    </div>
                </div>
            </section>

            {/* Filters */}
            {/* Filters */}
            <section className="border-b bg-background">
                <div className="mx-auto max-w-7xl px-6 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Phase
                            </span>

                            <select
                                value={phase}
                                onChange={(event) =>
                                    setPhase(
                                        event.target.value as (typeof phaseOptions)[number]
                                    )
                                }
                                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="all">All phases</option>
                                <option value="before">Before</option>
                                <option value="during">During</option>
                                <option value="after">After</option>
                                <option value="unknown">Unknown</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Verification
                            </span>

                            <select
                                value={verification}
                                onChange={(event) => setVerification(event.target.value)}
                                className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="all">All</option>
                                <option value="true">Verified</option>
                                <option value="false">Unverified</option>
                            </select>
                        </div>

                        <div className="ml-auto flex items-center gap-3">
                            <span className="text-sm font-medium">
                                {assets.length}
                            </span>

                            <span className="text-sm text-muted-foreground">
                                {assets.length === 1 ? "asset" : "assets"}
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Content */}
            <section className="mx-auto max-w-7xl px-6 py-8">
                {error && (
                    <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {loadingAssets ? (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div
                                key={index}
                                className="aspect-[4/3] animate-pulse rounded-xl bg-muted"
                            />
                        ))}
                    </div>
                ) : assets.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-12 text-center">
                        <h2 className="text-lg font-medium">
                            No evidence found
                        </h2>

                        <p className="mt-2 text-sm text-muted-foreground">
                            Try changing the project or filters.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {sites.map((site) => {
                            const siteAssets = assets.filter(
                                (asset) => asset.siteId === site.id
                            );

                            if (siteAssets.length === 0) return null;

                            return (
                                <section key={site.id}>
                                    <div className="mb-5 flex items-end justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold tracking-tight">
                                                {site.name}
                                            </h2>

                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {site.description}
                                            </p>
                                        </div>

                                        <span className="text-sm text-muted-foreground">
                                            {siteAssets.length}{" "}
                                            {siteAssets.length === 1 ? "asset" : "assets"}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                                        {siteAssets.map((asset) => (
                                            <AssetCard
                                                key={asset.id}
                                                asset={asset}
                                                onClick={async () => {
                                                    setSelectedAsset(asset);
                                                    setAssetDetails(null);
                                                    setLoadingAssetDetails(true);

                                                    try {
                                                        const response = await fetch(`/api/assets/${asset.id}`);

                                                        if (!response.ok) {
                                                            throw new Error("Failed to load asset details");
                                                        }

                                                        const result = await response.json();
                                                        setAssetDetails(result.data);
                                                    } catch (err) {
                                                        console.error(err);
                                                    } finally {
                                                        setLoadingAssetDetails(false);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Asset detail */}
            {selectedAsset && (
                <AssetDetails
                    asset={assetDetails ?? selectedAsset}
                    onClose={() => {
                        setSelectedAsset(null);
                        setAssetDetails(null);
                    }}
                />
            )}
        </main>
    );
}

function AssetCard({
    asset,
    onClick,
}: {
    asset: Asset;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="group overflow-hidden rounded-xl border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                    src={asset.secureUrl}
                    alt={asset.aiCaption || "Field evidence"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />

                <div className="absolute left-3 top-3">
                    <PhaseBadge phase={asset.phase} />
                </div>

                <div className="absolute right-3 top-3">
                    <span
                        className={`rounded-full border bg-background/90 px-2 py-1 text-[11px] font-medium backdrop-blur ${asset.verified
                            ? "text-foreground"
                            : "text-muted-foreground"
                            }`}
                    >
                        {asset.verified ? "Verified" : "Unverified"}
                    </span>
                </div>
            </div>

            <div className="p-4">
                <p className="line-clamp-2 text-sm font-medium">
                    {asset.aiCaption || "Field evidence"}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>
                        {asset.capturedAt
                            ? new Date(asset.capturedAt).toLocaleDateString()
                            : "Date unavailable"}
                    </span>

                    {asset.aiTags?.length > 0 && (
                        <span>{asset.aiTags.length} tags</span>
                    )}
                </div>
            </div>
        </button>
    );
}

function PhaseBadge({
    phase,
}: {
    phase: Asset["phase"];
}) {
    const labels = {
        before: "Before",
        during: "During",
        after: "After",
        unknown: "Unknown",
    };

    return (
        <span className="rounded-full border bg-background/90 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            {labels[phase]}
        </span>
    );
}

function AssetDetails({
    asset,
    onClose,
}: {
    asset: Asset;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="mx-auto flex max-h-[92vh] max-w-6xl overflow-hidden rounded-2xl border bg-background shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Image */}
                <div className="hidden w-[55%] bg-black md:block">
                    <img
                        src={asset.secureUrl}
                        alt={asset.aiCaption || "Field evidence"}
                        className="h-full max-h-[92vh] w-full object-contain"
                    />
                </div>

                {/* Information */}
                <div className="w-full overflow-y-auto md:w-[45%]">
                    <div className="sticky top-0 z-10 border-b bg-background/95 px-6 py-5 backdrop-blur">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    Evidence inspection
                                </p>

                                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                                    Field asset
                                </h2>
                            </div>

                            <button
                                onClick={onClose}
                                className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted"
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {/* Mobile image */}
                    <div className="bg-black md:hidden">
                        <img
                            src={asset.secureUrl}
                            alt={asset.aiCaption || "Field evidence"}
                            className="max-h-[45vh] w-full object-contain"
                        />
                    </div>

                    <div className="space-y-8 p-6">
                        {/* Status */}
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <PhaseBadge phase={asset.phase} />

                                <span
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${asset.verified
                                        ? "bg-foreground text-background"
                                        : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    {asset.verified ? "Verified evidence" : "Verification pending"}
                                </span>
                            </div>
                        </div>

                        {/* AI interpretation */}
                        <section>
                            <SectionLabel>AI interpretation</SectionLabel>

                            <p className="mt-3 text-sm leading-6 text-foreground">
                                {asset.aiCaption ||
                                    "No AI-generated caption is available for this asset."}
                            </p>

                            {asset.aiTags?.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {asset.aiTags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Evidence metadata */}
                        <section>
                            <SectionLabel>Evidence metadata</SectionLabel>

                            <div className="mt-4 space-y-3">
                                <DetailRow
                                    label="Phase"
                                    value={capitalize(asset.phase)}
                                />

                                <DetailRow
                                    label="Captured"
                                    value={
                                        asset.capturedAt
                                            ? new Date(asset.capturedAt).toLocaleString()
                                            : "Unavailable"
                                    }
                                />

                                <DetailRow
                                    label="Location"
                                    value={
                                        asset.lat !== null && asset.lng !== null
                                            ? `${asset.lat.toFixed(5)}, ${asset.lng.toFixed(5)}`
                                            : "Unavailable"
                                    }
                                />

                                <DetailRow
                                    label="Dimensions"
                                    value={
                                        asset.width && asset.height
                                            ? `${asset.width} × ${asset.height}`
                                            : "Unavailable"
                                    }
                                />

                                <DetailRow
                                    label="Format"
                                    value={asset.format?.toUpperCase() || "Unknown"}
                                />
                            </div>
                        </section>

                        {/* Verification */}
                        <section>
                            <SectionLabel>Verification</SectionLabel>

                            <div className="mt-4 rounded-xl border p-4">
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${asset.verified
                                            ? "bg-foreground text-background"
                                            : "bg-muted"
                                            }`}
                                    >
                                        {asset.verified ? "✓" : "!"}
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium">
                                            {asset.verified
                                                ? "Evidence verified"
                                                : "Verification requires attention"}
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            {asset.verified
                                                ? "This asset has passed the current verification state."
                                                : "This asset has not yet been marked as verified."}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {asset.flags?.length > 0 && (
                                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                                    <p className="text-sm font-medium">Evidence flags</p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {asset.flags.length} flag
                                        {asset.flags.length === 1 ? "" : "s"} associated with this
                                        asset.
                                    </p>
                                </div>
                            )}
                        </section>

                        {/* Provenance */}
                        <section>
                            <SectionLabel>Provenance</SectionLabel>

                            <div className="mt-4 rounded-xl border bg-muted/20 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">
                                            Source traceability
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            Original source and asset metadata for this evidence.
                                        </p>
                                    </div>

                                    <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-medium">
                                        TRACEABLE
                                    </span>
                                </div>

                                <div className="mt-4 space-y-3 border-t pt-4">
                                    <DetailRow
                                        label="Asset ID"
                                        value={asset.id.slice(0, 8) + "…"}
                                    />

                                    <DetailRow
                                        label="Cloudinary ID"
                                        value={asset.cloudinaryPublicId || "Unavailable"}
                                    />

                                    <DetailRow
                                        label="Uploaded"
                                        value={
                                            asset.createdAt
                                                ? new Date(asset.createdAt).toLocaleString()
                                                : "Unavailable"
                                        }
                                    />

                                    <DetailRow
                                        label="Embedding"
                                        value={
                                            asset.hasEmbedding
                                                ? "Available"
                                                : "Not available"
                                        }
                                    />

                                    <div className="border-t pt-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Original asset
                                        </p>

                                        <a
                                            href={asset.secureUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mt-2 inline-flex text-sm font-medium underline underline-offset-4 hover:opacity-70"
                                        >
                                            Open original image ↗
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: ReactNode }) {
    return (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {children}
        </p>
    );
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
function DetailRow({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-start justify-between gap-6 border-b pb-3">
            <span className="text-sm text-muted-foreground">
                {label}
            </span>

            <span className="text-right text-sm font-medium">
                {value}
            </span>
        </div>
    );
}