"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_PROJECT_ID =
    "acc78062-0358-43a1-a6e2-44f7af1793b4";

type Project = {
    id: string;
    name: string;
    description?: string | null;
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
    projectId: string;
    siteId: string | null;
    locationId?: string | null;
    secureUrl: string;
    phase: "before" | "during" | "after" | "unknown";
    capturedAt: string | null;
    verified: boolean;
    aiCaption: string | null;
};

type Metric = {
    name: string;
    reason: string;
    direction: string;
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
    metrics: Metric[];
    model: string;
    mode: "same_spot" | "representative";
    beforeUrl: string;
    afterUrl: string;
};

export default function ComparisonPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID);

    const [locations, setLocations] = useState<Location[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [savedComparisons, setSavedComparisons] = useState<Comparison[]>([]);

    const [selectedLocationId, setSelectedLocationId] = useState("");
    const [locationSearch, setLocationSearch] = useState("");
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);

    const [selectedBeforeId, setSelectedBeforeId] = useState("");
    const [selectedAfterId, setSelectedAfterId] = useState("");

    const [comparisonData, setComparisonData] =
        useState<Comparison | null>(null);

    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingEvidence, setLoadingEvidence] = useState(false);
    const [comparing, setComparing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadProjects() {
            try {
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

    useEffect(() => {
        if (!projectId) return;

        async function loadProjectEvidence() {
            try {
                setLoadingEvidence(true);
                setError("");

                setSelectedLocationId("");
                setLocationSearch("");
                setSelectedBeforeId("");
                setSelectedAfterId("");
                setComparisonData(null);

                const [locationsResponse, assetsResponse, comparisonsResponse] =
                    await Promise.all([
                        fetch(
                            `/api/locations?projectId=${encodeURIComponent(projectId)}`
                        ),
                        fetch(
                            `/api/assets?projectId=${encodeURIComponent(
                                projectId
                            )}&limit=500`
                        ),
                        fetch(
                            `/api/comparisons?projectId=${encodeURIComponent(projectId)}`
                        ),
                    ]);

                if (!locationsResponse.ok) {
                    throw new Error("Failed to load field locations");
                }

                if (!assetsResponse.ok) {
                    throw new Error("Failed to load evidence");
                }

                const locationsResult = await locationsResponse.json();
                const assetsResult = await assetsResponse.json();

                setLocations(locationsResult.data ?? []);
                setAssets(assetsResult.data ?? []);

                if (comparisonsResponse.ok) {
                    const comparisonsResult = await comparisonsResponse.json();
                    setSavedComparisons(comparisonsResult.data ?? []);
                } else {
                    setSavedComparisons([]);
                }
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load comparison data"
                );
            } finally {
                setLoadingEvidence(false);
            }
        }

        loadProjectEvidence();
    }, [projectId]);

    const selectedProject = projects.find(
        (project) => project.id === projectId
    );

    const selectedLocation = locations.find(
        (location) => location.id === selectedLocationId
    );

    const filteredLocations = useMemo(() => {
        const query = locationSearch.trim().toLowerCase();

        if (!query) return locations;

        return locations.filter((location) =>
            location.name.toLowerCase().includes(query)
        );
    }, [locations, locationSearch]);

    const locationAssets = useMemo(() => {
        if (!selectedLocationId) return [];

        return assets.filter((asset) => {
            if (asset.locationId === selectedLocationId) {
                return true;
            }

            if (
                selectedLocation?.siteId &&
                asset.siteId === selectedLocation.siteId
            ) {
                return true;
            }

            return false;
        });
    }, [assets, selectedLocationId, selectedLocation]);

    const beforeAssets = useMemo(
        () =>
            locationAssets
                .filter((asset) => asset.phase === "before")
                .sort(sortAssetsForComparison),
        [locationAssets]
    );

    const duringAssets = useMemo(
        () =>
            locationAssets
                .filter((asset) => asset.phase === "during")
                .sort(sortAssetsForComparison),
        [locationAssets]
    );

    const afterAssets = useMemo(
        () =>
            locationAssets
                .filter((asset) => asset.phase === "after")
                .sort(sortAssetsForComparison),
        [locationAssets]
    );

    const selectedBefore = beforeAssets.find(
        (asset) => asset.id === selectedBeforeId
    );

    const selectedAfter = afterAssets.find(
        (asset) => asset.id === selectedAfterId
    );

    function selectLocation(location: Location) {
        setSelectedLocationId(location.id);
        setLocationSearch(location.name);
        setLocationDropdownOpen(false);
        setComparisonData(null);

        const locationBefore = assets
            .filter(
                (asset) =>
                    (asset.locationId === location.id ||
                        (location.siteId && asset.siteId === location.siteId)) &&
                    asset.phase === "before"
            )
            .sort(sortAssetsForComparison);

        const locationAfter = assets
            .filter(
                (asset) =>
                    (asset.locationId === location.id ||
                        (location.siteId && asset.siteId === location.siteId)) &&
                    asset.phase === "after"
            )
            .sort(sortAssetsForComparison);

        setSelectedBeforeId(locationBefore[0]?.id ?? "");
        setSelectedAfterId(locationAfter[0]?.id ?? "");
    }

    async function runComparison() {
        if (!selectedBeforeId || !selectedAfterId) return;

        try {
            setComparing(true);
            setError("");

            const response = await fetch("/api/comparisons", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    beforeAssetId: selectedBeforeId,
                    afterAssetId: selectedAfterId,
                    mode: "same_spot",
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result?.error?.message ||
                    result?.message ||
                    "Failed to create comparison"
                );
            }

            const comparison = result.data;

            setComparisonData(comparison);

            setSavedComparisons((current) => [
                comparison,
                ...current.filter(
                    (item) => item.id !== comparison.id
                ),
            ]);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to create comparison"
            );
        } finally {
            setComparing(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f8f6] text-[#172019]">
            <header className="border-b border-black/[0.07] bg-white">
                <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
                    <div>
                        <p className="text-[15px] font-semibold">
                            FieldProof
                        </p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            Impact comparison
                        </p>
                    </div>

                    <a
                        href="/project/acc78062-0358-43a1-a6e2-44f7af1793b4"
                        className="text-sm text-muted-foreground transition hover:text-foreground"
                    >
                        ← Project
                    </a>
                </div>
            </header>

            <div className="mx-auto max-w-[1500px] px-6 py-10 lg:px-10">
                {/* Heading */}
                <section className="mb-8">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Before & After
                    </p>

                    <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
                        Compare change at a field location.
                    </h1>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Select a named field location. FieldProof finds the evidence
                        collected there and suggests a Before / After pair automatically.
                    </p>
                </section>

                {/* Project + Location */}
                <section className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm">
                    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                        <div>
                            <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                Project
                            </label>

                            <select
                                value={projectId}
                                onChange={(event) =>
                                    setProjectId(event.target.value)
                                }
                                className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-4 text-sm outline-none focus:border-black/30"
                            >
                                {loadingProjects ? (
                                    <option>Loading projects...</option>
                                ) : (
                                    projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                Field location
                            </label>

                            <input
                                value={locationSearch}
                                onChange={(event) => {
                                    setLocationSearch(event.target.value);
                                    setLocationDropdownOpen(true);
                                }}
                                onFocus={() => setLocationDropdownOpen(true)}
                                placeholder="Search or select a field location..."
                                className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-4 text-sm outline-none focus:border-black/30"
                            />

                            {locationDropdownOpen && (
                                <div className="absolute left-0 right-0 top-[4.7rem] z-30 max-h-80 overflow-y-auto rounded-xl border border-black/[0.08] bg-white p-1 shadow-xl">
                                    {loadingEvidence ? (
                                        <div className="px-4 py-5 text-sm text-muted-foreground">
                                            Loading locations...
                                        </div>
                                    ) : filteredLocations.length === 0 ? (
                                        <div className="px-4 py-5 text-sm text-muted-foreground">
                                            No field locations found.
                                        </div>
                                    ) : (
                                        filteredLocations.map((location) => {
                                            const locationEvidence = assets.filter(
                                                (asset) =>
                                                    asset.locationId === location.id ||
                                                    (location.siteId && asset.siteId === location.siteId)
                                            );

                                            const beforeCount =
                                                locationEvidence.filter(
                                                    (asset) => asset.phase === "before"
                                                ).length;

                                            const duringCount =
                                                locationEvidence.filter(
                                                    (asset) => asset.phase === "during"
                                                ).length;

                                            const afterCount =
                                                locationEvidence.filter(
                                                    (asset) => asset.phase === "after"
                                                ).length;

                                            return (
                                                <button
                                                    key={location.id}
                                                    type="button"
                                                    onClick={() =>
                                                        selectLocation(location)
                                                    }
                                                    className="w-full rounded-lg px-4 py-3 text-left transition hover:bg-[#f3f5f2]"
                                                >
                                                    <p className="text-sm font-medium">
                                                        {location.name}
                                                    </p>

                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {beforeCount} before · {duringCount}{" "}
                                                        during · {afterCount} after
                                                    </p>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Selected location */}
                {selectedLocation && (
                    <section className="mt-8">
                        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    Selected field location
                                </p>

                                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                                    {selectedLocation.name}
                                </h2>
                            </div>

                            <div className="text-sm text-muted-foreground">
                                {locationAssets.length} evidence{" "}
                                {locationAssets.length === 1 ? "asset" : "assets"}
                            </div>
                        </div>

                        {/* Pair */}
                        <div className="grid gap-5 lg:grid-cols-2">
                            <EvidenceSelector
                                label="Before"
                                description="Choose the evidence representing the earlier state."
                                assets={beforeAssets}
                                selectedId={selectedBeforeId}
                                onSelect={setSelectedBeforeId}
                            />

                            <EvidenceSelector
                                label="After"
                                description="Choose the evidence representing the later state."
                                assets={afterAssets}
                                selectedId={selectedAfterId}
                                onSelect={setSelectedAfterId}
                            />
                        </div>

                        {/* During evidence */}
                        {duringAssets.length > 0 && (
                            <div className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-5">
                                <div>
                                    <p className="text-sm font-semibold">
                                        During
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Evidence captured while restoration activity was underway.
                                    </p>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                                    {duringAssets.map((asset) => (
                                        <img
                                            key={asset.id}
                                            src={asset.secureUrl}
                                            alt="During evidence"
                                            className="aspect-square w-full rounded-xl border object-cover"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Compare action */}
                        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-black/[0.08] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold">
                                    Ready to compare
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    {selectedBefore
                                        ? "Before selected"
                                        : "Select a Before image"}{" "}
                                    ·{" "}
                                    {selectedAfter
                                        ? "After selected"
                                        : "Select an After image"}
                                </p>
                            </div>

                            <button
                                type="button"
                                disabled={
                                    !selectedBefore ||
                                    !selectedAfter ||
                                    comparing
                                }
                                onClick={runComparison}
                                className="rounded-xl bg-[#172019] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#29382f] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {comparing
                                    ? "Analyzing change..."
                                    : "Compare these images →"}
                            </button>
                        </div>
                    </section>
                )}

                {/* AI result */}
                {comparisonData && (
                    <section className="mt-10">
                        <div className="mb-5">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                AI change assessment
                            </p>

                            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                                What changed?
                            </h2>
                        </div>

                        <ComparisonSlider
                            before={comparisonData.beforeUrl}
                            after={comparisonData.afterUrl}
                        />

                        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
                            <div className="rounded-2xl border border-black/[0.08] bg-white p-6">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full border bg-[#f1f3f0] text-xs font-semibold">
                                        AI
                                    </span>

                                    <div>
                                        <p className="text-sm font-semibold">
                                            Vision assessment
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            {comparisonData.model}
                                        </p>
                                    </div>
                                </div>

                                <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                                    {comparisonData.headline}
                                </h3>

                                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                                    {comparisonData.summary}
                                </p>

                                {comparisonData.metrics?.length > 0 && (
                                    <div className="mt-7 border-t pt-6">
                                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                            Detected changes
                                        </p>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            {comparisonData.metrics.map((metric) => (
                                                <div
                                                    key={metric.name}
                                                    className="rounded-xl border p-4"
                                                >
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatMetricName(metric.name)}
                                                    </p>

                                                    <p className="mt-2 text-sm font-semibold">
                                                        {metric.direction}
                                                    </p>

                                                    {metric.reason && (
                                                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                                            {metric.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-black/[0.08] bg-white">
                                <InfoRow
                                    label="Location"
                                    value={selectedLocation?.name ?? "—"}
                                />

                                <InfoRow
                                    label="Same location"
                                    value={
                                        comparisonData.sameLocation
                                            ? "Confirmed"
                                            : "Review needed"
                                    }
                                />

                                <InfoRow
                                    label="Location confidence"
                                    value={`${Math.round(
                                        comparisonData.locationConfidence * 100
                                    )}%`}
                                />

                                <InfoRow
                                    label="Mode"
                                    value={comparisonData.mode}
                                />

                                <InfoRow
                                    label="Before"
                                    value={selectedBefore?.capturedAt
                                        ? formatDate(selectedBefore.capturedAt)
                                        : "—"}
                                />

                                <InfoRow
                                    label="After"
                                    value={selectedAfter?.capturedAt
                                        ? formatDate(selectedAfter.capturedAt)
                                        : "—"}
                                    last
                                />
                            </div>
                        </div>
                    </section>
                )}

                {/* Previous comparisons */}
                {savedComparisons.length > 0 && (
                    <section className="mt-12 border-t border-black/[0.08] pt-10">
                        <div className="mb-5">
                            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Saved comparisons
                            </p>

                            <h2 className="mt-1 text-xl font-semibold">
                                Previous assessments
                            </h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {savedComparisons.slice(0, 6).map((comparison) => (
                                <button
                                    key={comparison.id}
                                    type="button"
                                    onClick={() =>
                                        setComparisonData(comparison)
                                    }
                                    className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <div className="grid grid-cols-2">
                                        <img
                                            src={comparison.beforeUrl}
                                            alt="Before"
                                            className="aspect-[4/3] w-full object-cover"
                                        />

                                        <img
                                            src={comparison.afterUrl}
                                            alt="After"
                                            className="aspect-[4/3] w-full object-cover"
                                        />
                                    </div>

                                    <div className="p-4">
                                        <p className="text-sm font-semibold">
                                            {comparison.headline}
                                        </p>

                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                            {comparison.summary}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    );
}

function EvidenceSelector({
    label,
    description,
    assets,
    selectedId,
    onSelect,
}: {
    label: string;
    description: string;
    assets: Asset[];
    selectedId: string;
    onSelect: (id: string) => void;
}) {
    const selected = assets.find(
        (asset) => asset.id === selectedId
    );

    return (
        <div className="rounded-2xl border border-black/[0.08] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {description}
                    </p>
                </div>

                <span className="rounded-full border bg-[#f6f7f5] px-2.5 py-1 text-[11px]">
                    {assets.length}{" "}
                    {assets.length === 1 ? "image" : "images"}
                </span>
            </div>

            {assets.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed p-8 text-center">
                    <p className="text-sm font-medium">
                        No {label.toLowerCase()} evidence
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                        Add evidence for this phase at this location.
                    </p>
                </div>
            ) : (
                <>
                    {selected && (
                        <div className="mt-5 overflow-hidden rounded-xl border">
                            <img
                                src={selected.secureUrl}
                                alt={label}
                                className="aspect-[16/10] w-full object-cover"
                            />

                            <div className="flex items-center justify-between px-4 py-3">
                                <div>
                                    <p className="text-sm font-medium">
                                        Selected {label}
                                    </p>

                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {selected.capturedAt
                                            ? formatDate(selected.capturedAt)
                                            : "Capture date unavailable"}
                                    </p>
                                </div>

                                {selected.verified && (
                                    <span className="rounded-full border px-2.5 py-1 text-[11px]">
                                        Verified
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {assets.map((asset) => (
                            <button
                                key={asset.id}
                                type="button"
                                onClick={() => onSelect(asset.id)}
                                className={`relative overflow-hidden rounded-lg border-2 transition ${asset.id === selectedId
                                    ? "border-[#172019]"
                                    : "border-transparent hover:border-black/20"
                                    }`}
                            >
                                <img
                                    src={asset.secureUrl}
                                    alt={label}
                                    className="aspect-square w-full object-cover"
                                />

                                {asset.id === selectedId && (
                                    <span className="absolute bottom-1 right-1 rounded-full bg-[#172019] px-1.5 py-0.5 text-[9px] font-medium text-white">
                                        Selected
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function ComparisonSlider({
    before,
    after,
}: {
    before: string;
    after: string;
}) {
    const [position, setPosition] = useState(50);

    return (
        <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
            <div className="relative aspect-[16/9] overflow-hidden bg-black">
                <img
                    src={after}
                    alt="After"
                    className="absolute inset-0 h-full w-full object-cover"
                />

                <div
                    className="absolute inset-y-0 left-0 overflow-hidden"
                    style={{ width: `${position}%` }}
                >
                    <img
                        src={before}
                        alt="Before"
                        className="h-full w-full object-cover"
                        style={{
                            width: "100vw",
                            maxWidth: "none",
                        }}
                    />
                </div>

                <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                    Before
                </span>

                <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm">
                    After
                </span>

                <div
                    className="absolute inset-y-0 z-10 w-px bg-white"
                    style={{ left: `${position}%` }}
                >
                    <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#172019] text-sm text-white shadow-lg">
                        ↔
                    </div>
                </div>

                <input
                    type="range"
                    min="0"
                    max="100"
                    value={position}
                    onChange={(event) =>
                        setPosition(Number(event.target.value))
                    }
                    className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
                    aria-label="Drag to compare before and after"
                />
            </div>

            <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-medium">Before</span>

                <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    Drag to compare
                </span>

                <span className="text-sm font-medium">After</span>
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

function sortAssetsForComparison(a: Asset, b: Asset) {
    if (a.verified !== b.verified) {
        return a.verified ? -1 : 1;
    }

    if (!a.capturedAt && !b.capturedAt) return 0;
    if (!a.capturedAt) return 1;
    if (!b.capturedAt) return -1;

    return (
        new Date(a.capturedAt).getTime() -
        new Date(b.capturedAt).getTime()
    );
}

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatMetricName(value: string) {
    return value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}