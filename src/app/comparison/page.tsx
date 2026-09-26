"use client";

import { useEffect, useState } from "react";
type Asset = {
    id: string;
    siteId: string | null;
    secureUrl: string;
    phase: "before" | "during" | "after" | "unknown";
    capturedAt: string | null;
};

type Project = {
    id: string;
    name: string;
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


export default function ComparisonPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState("");

    const [comparisonData, setComparisonData] =
        useState<Comparison | null>(null);

    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingComparison, setLoadingComparison] = useState(false);
    const [error, setError] = useState("");

    // Load projects
    useEffect(() => {
        async function loadProjects() {
            try {
                setLoadingProjects(true);
                setError("");

                const response = await fetch("/api/projects");

                if (!response.ok) {
                    throw new Error("Failed to load projects");
                }

                const result = await response.json();

                setProjects(result.data ?? []);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load projects"
                );
            } finally {
                setLoadingProjects(false);
            }
        }

        loadProjects();
    }, []);

    // Load comparisons only after a project is selected
    useEffect(() => {
        if (!selectedProject) {
            setComparisonData(null);
            return;
        }

        async function loadComparison() {
            try {
                setLoadingComparison(true);
                setError("");

                const response = await fetch(
                    `/api/comparisons?projectId=${selectedProject}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load comparisons");
                }

                const result = await response.json();

                const comparisons = result.data ?? [];

                if (comparisons.length > 0) {
                    setComparisonData(comparisons[0]);
                } else {
                    setComparisonData(null);
                    setError("No saved comparisons found for this project.");
                }
            } catch (err) {
                setComparisonData(null);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load comparison"
                );
            } finally {
                setLoadingComparison(false);
            }
        }

        loadComparison();
    }, [selectedProject]);

    const getMetric = (name: string) =>
        comparisonData?.metrics.find((metric) => metric.name === name)?.direction ??
        "Not available";

    return (
        <main className="min-h-screen bg-background">
            {/* Header */}
            <section className="border-b">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="flex flex-col gap-6">
                        <div>
                            <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                Impact comparison
                            </p>

                            <h1 className="text-4xl font-semibold tracking-tight">
                                Before & After
                            </h1>

                            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
                                Compare field evidence and understand the change observed
                                between project phases.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={selectedProject}
                                onChange={(event) => setSelectedProject(event.target.value)}
                                disabled={loadingProjects}
                                className="h-10 rounded-full border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">
                                    {loadingProjects
                                        ? "Loading projects..."
                                        : "Select a project"}
                                </option>

                                {projects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>

                            {comparisonData?.siteId && (
                                <span className="rounded-full border bg-muted/40 px-3 py-1.5 text-sm">
                                    Comparison site
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Comparison */}
            <section className="mx-auto max-w-7xl px-6 py-10">
                {!selectedProject && !loadingProjects && (
                    <div className="rounded-2xl border border-dashed p-12 text-center">
                        <h3 className="text-lg font-semibold">
                            Select a project to view comparisons
                        </h3>

                        <p className="mt-2 text-sm text-muted-foreground">
                            Choose a project above to load its saved before-and-after
                            evidence.
                        </p>
                    </div>
                )}
                {comparisonData && (
                    <ComparisonSlider
                        before={{
                            url: comparisonData.beforeUrl,
                            date: "",
                        }}
                        after={{
                            url: comparisonData.afterUrl,
                            date: "",
                        }}
                    />
                )}
                {selectedProject && !loadingComparison && !comparisonData && (
                    <div className="rounded-2xl border border-dashed p-12 text-center">
                        <h3 className="text-lg font-semibold">
                            No comparison available
                        </h3>

                        <p className="mt-2 text-sm text-muted-foreground">
                            This project does not have a saved before-and-after comparison yet.
                        </p>
                    </div>
                )}
                {/* AI Assessment */}
                <section className="mt-8">
                    <div className="mb-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            AI assessment
                        </p>

                        <h2 className="mt-1 text-xl font-semibold tracking-tight">
                            What changed?
                        </h2>
                    </div>

                    <div className="rounded-2xl border bg-card p-6">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                            {/* Summary */}
                            <div className="max-w-2xl">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-sm">
                                        AI
                                    </span>

                                    <span className="text-sm font-medium">
                                        Vision assessment
                                    </span>
                                </div>

                                <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                                    {loadingComparison
                                        ? "Loading comparison..."
                                        : comparisonData?.headline ?? "Select a project to begin"}
                                </h3>

                                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                    {loadingComparison
                                        ? "Loading comparison..."
                                        : comparisonData?.summary ??
                                        "Select a project above to view the AI assessment."}
                                </p>
                            </div>

                            {/* Location confidence */}
                            <div className="w-full rounded-xl border bg-muted/30 p-4 lg:max-w-xs">
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Location match
                                </p>

                                <div className="mt-3 flex items-end justify-between">
                                    <span className="text-3xl font-semibold">
                                        {Math.round((comparisonData?.locationConfidence ?? 0) * 100)}%
                                    </span>

                                    <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                                        {comparisonData?.sameLocation
                                            ? "Same location"
                                            : "Review needed"}
                                    </span>
                                </div>

                                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-foreground transition-all"
                                        style={{
                                            width: `${(comparisonData?.locationConfidence ?? 0) * 100}%`,
                                        }}
                                    />
                                </div>

                                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                                    Confidence that both images represent the same field location.
                                </p>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="mt-8 border-t pt-6">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Detected changes
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-xl border p-4">
                                    <p className="text-xs text-muted-foreground">
                                        Waste & debris
                                    </p>
                                    <p className="mt-2 text-sm font-semibold">
                                        {getMetric("waste_and_debris")}
                                    </p>
                                </div>

                                <div className="rounded-xl border p-4">
                                    <p className="text-xs text-muted-foreground">
                                        Vegetation cover
                                    </p>
                                    <p className="mt-2 text-sm font-semibold">
                                        {getMetric("vegetation_cover")}
                                    </p>
                                </div>

                                <div className="rounded-xl border p-4">
                                    <p className="text-xs text-muted-foreground">
                                        Water clarity
                                    </p>
                                    <p className="mt-2 text-sm font-semibold">
                                        {getMetric("water_clarity")}
                                    </p>
                                </div>

                                <div className="rounded-xl border p-4">
                                    <p className="text-xs text-muted-foreground">
                                        Human activity
                                    </p>
                                    <p className="mt-2 text-sm font-semibold">
                                        {getMetric("human_activity")}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Model information */}
                        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-5 text-xs text-muted-foreground">
                            <span>
                                Mode: <strong className="font-medium text-foreground">
                                    {comparisonData?.mode}
                                </strong>
                            </span>

                            <span>
                                Model: <strong className="font-medium text-foreground">
                                    {comparisonData?.model ?? "AI vision assessment"}
                                </strong>
                            </span>
                        </div>
                    </div>
                </section>
            </section>

            {/* AI Assessment */}
            <section className="border-t">
                <div className="mx-auto max-w-7xl px-6 py-10">
                    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                AI change assessment
                            </p>

                            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                                comparisonData?.headline ?? "Loading comparison..."
                            </h2>

                            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                                {comparisonData?.summary ?? "Loading comparison..."}
                            </p>
                        </div>

                        <div className="rounded-xl border">
                            <InfoRow
                                label="Same location"
                                value={comparisonData?.sameLocation ? "Same location" : "Review needed"}
                            />

                            <InfoRow
                                label="Location confidence"
                                value={`${Math.round(
                                    (comparisonData?.locationConfidence ?? 0) * 100
                                )}%`}
                            />

                            <InfoRow
                                label="Comparison mode"
                                value={comparisonData?.mode ?? "same_spot"}
                            />

                            <InfoRow
                                label="Assessment"
                                value={comparisonData?.model ?? "AI vision assessment"}
                                last
                            />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

function ImageCard({
    label,
    date,
    src,
}: {
    label: string;
    date: string;
    src: string;
}) {
    return (
        <div className="overflow-hidden rounded-2xl border bg-background">
            <div className="relative aspect-[4/3] bg-muted">
                <img
                    src={src}
                    alt={label}
                    className="h-full w-full object-cover"
                />

                <span className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                    {label}
                </span>
            </div>

            <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-medium">{label}</span>

                <span className="text-sm text-muted-foreground">
                    {date}
                </span>
            </div>
        </div>
    );
}

function ComparisonSlider({
    before,
    after,
}: {
    before: {
        url: string;
        date: string;
    };
    after: {
        url: string;
        date: string;
    };
}) {
    const [position, setPosition] = useState(50);

    return (
        <div className="overflow-hidden rounded-2xl border bg-background">
            <div className="relative aspect-[16/9] overflow-hidden bg-black">
                {/* AFTER image */}
                <img
                    src={after.url}
                    alt="After"
                    className="absolute inset-0 h-full w-full object-cover"
                />

                {/* BEFORE image */}
                <div
                    className="absolute inset-y-0 left-0 overflow-hidden"
                    style={{ width: `${position}%` }}
                >
                    <img
                        src={before.url}
                        alt="Before"
                        className="h-full w-full object-cover"
                        style={{
                            width: `calc(100vw)`,
                            maxWidth: "none",
                        }}
                    />
                </div>

                {/* Before label */}
                <span className="absolute left-4 top-4 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                    Before
                </span>

                {/* After label */}
                <span className="absolute right-4 top-4 rounded-full bg-background/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                    After
                </span>

                {/* Divider */}
                <div
                    className="absolute inset-y-0 z-10 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
                    style={{ left: `${position}%` }}
                >
                    <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-background text-sm font-semibold shadow-lg">
                        ↔
                    </div>
                </div>

                {/* Slider */}
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={position}
                    onChange={(event) =>
                        setPosition(Number(event.target.value))
                    }
                    className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                    aria-label="Compare before and after"
                />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
                <div>
                    <p className="text-sm font-medium">Before</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {before.date}
                    </p>
                </div>

                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Drag to compare
                </p>

                <div className="text-right">
                    <p className="text-sm font-medium">After</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {after.date}
                    </p>
                </div>
            </div>
        </div>
    );
}

function InfoRow({
    label,
    value,
    last = false,
}: {
    label: string;
    value: string;
    last?: boolean;
}) {
    return (
        <div
            className={`flex items-center justify-between gap-4 px-4 py-3 ${last ? "" : "border-b"
                }`}
        >
            <span className="text-sm text-muted-foreground">
                {label}
            </span>

            <span className="text-right text-sm font-medium">
                {value}
            </span>
        </div>
    );
}