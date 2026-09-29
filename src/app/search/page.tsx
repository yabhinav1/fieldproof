"use client";

import { FormEvent, Suspense, useEffect, useId, useState } from "react";
import Link from "next/link";

import { apiFetch, errorMessage } from "@/lib/api";
import { thumbnailUrl } from "@/lib/cloudinary-url";
import { useProjects } from "@/lib/use-projects";

type Site = {
    id: string;
    name: string;
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
    siteId: string | null;
    locationId: string | null;
    phase: "before" | "during" | "after" | "unknown";
    capturedAt: string | null;
    aiTags: string[];
    aiCaption: string | null;
    verified: boolean;
};

type SearchHit = {
    asset: Asset;
    score: number;
    matchedBy: Array<"semantic" | "keyword">;
};

type SearchResponse = {
    mode: string;
    hits: SearchHit[];
};

const phaseOptions = [
    { value: "", label: "All phases" },
    { value: "before", label: "Before" },
    { value: "during", label: "During" },
    { value: "after", label: "After" },
    { value: "unknown", label: "Unknown" },
];

export default function SearchPage() {
    return (
        <Suspense fallback={null}>
            <SearchView />
        </Suspense>
    );
}

function SearchView() {
    const {
        projects,
        projectId,
        setProjectId,
        loading: loadingProjects,
        error: projectsError,
    } = useProjects();

    const [sites, setSites] = useState<Site[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);

    const [siteId, setSiteId] = useState("");
    const [locationId, setLocationId] = useState("");
    const [phase, setPhase] = useState("");
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [query, setQuery] = useState("");

    const [results, setResults] = useState<SearchHit[]>([]);
    const [mode, setMode] = useState("");

    /* The query the results on screen belong to; empty until a search has run. */
    const [searchedFor, setSearchedFor] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const queryInputId = useId();

    useEffect(() => {
        if (!projectId) return;

        let cancelled = false;

        async function loadProjectFilters() {
            try {
                const [project, locationList] = await Promise.all([
                    apiFetch<{ sites?: Site[] }>(
                        `/api/projects/${encodeURIComponent(projectId)}`,
                        undefined,
                        "Failed to load sites"
                    ),
                    apiFetch<Location[]>(
                        `/api/locations?projectId=${encodeURIComponent(
                            projectId
                        )}`,
                        undefined,
                        "Failed to load field locations"
                    ),
                ]);

                if (cancelled) return;

                setSites(project?.sites ?? []);
                setLocations(locationList ?? []);
            } catch (err) {
                if (cancelled) return;

                setSites([]);
                setLocations([]);

                setError(
                    errorMessage(err, "Failed to load project filters")
                );
            }
        }

        loadProjectFilters();

        return () => {
            cancelled = true;
        };
    }, [projectId]);

    /* Nothing from the previous project may linger under the new one. */
    function changeProject(id: string) {
        setProjectId(id);

        setSites([]);
        setLocations([]);
        setSiteId("");
        setLocationId("");

        setResults([]);
        setMode("");
        setSearchedFor("");
        setError("");
    }

    /* A location belongs to one site, so the two filters must agree. */
    const siteLocations = locations.filter(
        (location) => !siteId || location.siteId === siteId
    );

    const topScore = results[0]?.score ?? 0;

    async function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const text = query.trim();

        if (!text || !projectId || loading) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                q: text,
                projectId,
                limit: "30",
            });

            if (siteId) {
                params.set("siteId", siteId);
            }

            if (locationId) {
                params.set("locationId", locationId);
            }

            if (phase) {
                params.set("phase", phase);
            }

            if (verifiedOnly) {
                params.set("verifiedOnly", "true");
            }

            const data = await apiFetch<SearchResponse>(
                `/api/search?${params.toString()}`,
                undefined,
                "Search failed"
            );

            setResults(data?.hits ?? []);
            setMode(data?.mode ?? "");
            setSearchedFor(text);
        } catch (err) {
            setResults([]);
            setMode("");
            setSearchedFor("");

            setError(errorMessage(err, "Search failed"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-background">
            <section className="mx-auto max-w-7xl px-6 py-14">
                <div className="max-w-3xl">
                    <Link
                        href={projectId ? `/project/${projectId}` : "/"}
                        className="mb-8 inline-block text-sm text-muted-foreground transition hover:text-foreground"
                    >
                        ← {projectId ? "Project dashboard" : "Projects"}
                    </Link>

                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                        Evidence search
                    </p>

                    <h1 className="mt-4 text-5xl font-semibold tracking-tight">
                        Find field evidence
                    </h1>

                    <p className="mt-4 text-lg leading-8 text-muted-foreground">
                        Search across field photos using natural
                        language, AI captions, tags, and semantic
                        similarity.
                    </p>
                </div>

                <form
                    onSubmit={handleSearch}
                    className="mt-10 rounded-2xl border bg-card p-5 shadow-sm"
                >
                    <div className="flex flex-col gap-4 lg:flex-row">
                        <div className="flex-1">
                            <label
                                htmlFor={queryInputId}
                                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Search evidence
                            </label>

                            <input
                                id={queryInputId}
                                type="search"
                                maxLength={500}
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                                placeholder="e.g. riverbank cleanup with reduced waste"
                                className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={
                                loading ||
                                !query.trim() ||
                                !projectId
                            }
                            className="mt-auto h-12 rounded-xl bg-foreground px-7 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading
                                ? "Searching..."
                                : "Search evidence"}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                        <select
                            aria-label="Project"
                            value={projectId}
                            onChange={(event) =>
                                changeProject(event.target.value)
                            }
                            disabled={
                                loadingProjects ||
                                loading ||
                                projects.length === 0
                            }
                            className="h-11 rounded-xl border bg-background px-3 text-sm"
                        >
                            {loadingProjects ? (
                                <option>Loading projects...</option>
                            ) : projects.length === 0 ? (
                                <option>No projects found</option>
                            ) : (
                                projects.map((project) => (
                                    <option
                                        key={project.id}
                                        value={project.id}
                                    >
                                        {project.name}
                                    </option>
                                ))
                            )}
                        </select>

                        <select
                            aria-label="Site"
                            value={siteId}
                            onChange={(event) => {
                                setSiteId(event.target.value);
                                setLocationId("");
                            }}
                            className="h-11 rounded-xl border bg-background px-3 text-sm"
                        >
                            <option value="">
                                All sites
                            </option>

                            {sites.map((site) => (
                                <option
                                    key={site.id}
                                    value={site.id}
                                >
                                    {site.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Field location"
                            value={locationId}
                            onChange={(event) =>
                                setLocationId(event.target.value)
                            }
                            className="h-11 rounded-xl border bg-background px-3 text-sm"
                        >
                            <option value="">
                                All field locations
                            </option>

                            {siteLocations.map((location) => (
                                <option
                                    key={location.id}
                                    value={location.id}
                                >
                                    {location.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Phase"
                            value={phase}
                            onChange={(event) =>
                                setPhase(event.target.value)
                            }
                            className="h-11 rounded-xl border bg-background px-3 text-sm"
                        >
                            {phaseOptions.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={verifiedOnly}
                            onChange={(event) =>
                                setVerifiedOnly(
                                    event.target.checked
                                )
                            }
                            className="h-4 w-4"
                        />

                        Show verified evidence only
                    </label>
                </form>

                {[projectsError, error].filter(Boolean).map((message) => (
                    <div
                        key={message}
                        role="alert"
                        className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
                    >
                        {message}
                    </div>
                ))}

                <section className="mt-12" aria-busy={loading}>
                    <div className="flex items-end justify-between border-b pb-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Search results
                            </p>

                            <h2
                                role="status"
                                className="mt-2 text-2xl font-semibold"
                            >
                                {loading
                                    ? "Searching..."
                                    : results.length > 0
                                      ? `${results.length} evidence ${
                                            results.length === 1
                                                ? "match"
                                                : "matches"
                                        }`
                                      : searchedFor
                                        ? "No matches"
                                        : "No results yet"}
                            </h2>
                        </div>

                        {mode && (
                            <span className="rounded-full border px-3 py-1.5 text-xs font-medium">
                                {mode}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={index}
                                    className="aspect-[4/5] animate-pulse rounded-2xl bg-muted"
                                />
                            ))}
                        </div>
                    ) : results.length === 0 ? (
                        <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
                            <p className="text-sm font-medium">
                                {searchedFor
                                    ? `Nothing matched “${searchedFor}”`
                                    : "Search your field evidence"}
                            </p>

                            <p className="mt-2 text-sm text-muted-foreground">
                                {searchedFor
                                    ? "Try different words, or widen the site, location, and phase filters."
                                    : "Try phrases such as “riverbank cleanup”, “plantation activity”, or “waste near the river”."}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {results.map((hit) => (
                                <Link
                                    key={hit.asset.id}
                                    href={`/gallery?projectId=${projectId}&asset=${hit.asset.id}`}
                                    className="overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <div className="aspect-[4/3] bg-muted">
                                        {/* The caption is printed below, so the image itself is decorative. */}
                                        <img
                                            src={thumbnailUrl(
                                                hit.asset.secureUrl
                                            )}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>

                                    <div className="p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide">
                                                {hit.asset.phase}
                                            </span>

                                            {hit.asset.verified && (
                                                <span className="text-xs font-medium">
                                                    Verified
                                                </span>
                                            )}
                                        </div>

                                        <p className="mt-4 line-clamp-3 text-sm leading-6">
                                            {hit.asset.aiCaption ??
                                                "No AI caption available."}
                                        </p>

                                        {hit.asset.aiTags?.length > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-1.5">
                                                {hit.asset.aiTags
                                                    .slice(0, 4)
                                                    .map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="rounded-full bg-muted px-2 py-1 text-[10px]"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                            </div>
                                        )}

                                        <div className="mt-5 flex items-center justify-between border-t pt-4">
                                            {/*
                                              * The score is a rank-fusion sum that tops out near 0.03,
                                              * so it is shown relative to the best hit.
                                              */}
                                            <span className="text-xs text-muted-foreground">
                                                Relevance{" "}
                                                {topScore > 0
                                                    ? Math.round(
                                                          (hit.score /
                                                              topScore) *
                                                              100
                                                      )
                                                    : 0}
                                                %
                                            </span>

                                            <span className="text-xs text-muted-foreground">
                                                {hit.matchedBy.join(
                                                    " + "
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}
