"use client";

import { FormEvent, useEffect, useState } from "react";

type Project = {
    id: string;
    name: string;
};

type Site = {
    id: string;
    name: string;
};

type Asset = {
    id: string;
    secureUrl: string;
    siteId: string | null;
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
    const [projects, setProjects] = useState<Project[]>([]);
    const [sites, setSites] = useState<Site[]>([]);

    const [projectId, setProjectId] = useState("");
    const [siteId, setSiteId] = useState("");
    const [phase, setPhase] = useState("");
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [query, setQuery] = useState("");

    const [results, setResults] = useState<SearchHit[]>([]);
    const [mode, setMode] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadProjects() {
            try {
                setLoadingProjects(true);

                const response = await fetch("/api/projects");

                if (!response.ok) {
                    throw new Error("Failed to load projects");
                }

                const result = await response.json();
                const data: Project[] = result.data ?? [];

                setProjects(data);

                if (data.length > 0) {
                    setProjectId(data[0].id);
                }
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
        if (!projectId) {
            setSites([]);
            return;
        }

        async function loadSites() {
            try {
                const response = await fetch(`/api/projects/${projectId}`);

                if (!response.ok) {
                    throw new Error("Failed to load sites");
                }

                const result = await response.json();
                setSites(result.data?.sites ?? []);
            } catch {
                setSites([]);
            }
        }

        loadSites();
        setSiteId("");
    }, [projectId]);

    async function handleSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!query.trim() || !projectId) {
            return;
        }

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                q: query.trim(),
                projectId,
                limit: "30",
            });

            if (siteId) {
                params.set("siteId", siteId);
            }

            if (phase) {
                params.set("phase", phase);
            }

            if (verifiedOnly) {
                params.set("verifiedOnly", "true");
            }

            const response = await fetch(`/api/search?${params.toString()}`);

            if (!response.ok) {
                throw new Error("Search failed");
            }

            const result = await response.json();
            const data: SearchResponse = result.data;

            setResults(data?.hits ?? []);
            setMode(data?.mode ?? "");
        } catch (err) {
            setResults([]);
            setMode("");
            setError(
                err instanceof Error ? err.message : "Search failed"
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen bg-background">
            <section className="mx-auto max-w-7xl px-6 py-14">
                <div className="max-w-3xl">
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                        Evidence search
                    </p>

                    <h1 className="mt-4 text-5xl font-semibold tracking-tight">
                        Find field evidence
                    </h1>

                    <p className="mt-4 text-lg leading-8 text-muted-foreground">
                        Search across field photos using natural language,
                        AI captions, tags, and semantic similarity.
                    </p>
                </div>

                <form
                    onSubmit={handleSearch}
                    className="mt-10 rounded-2xl border bg-card p-5 shadow-sm"
                >
                    <div className="flex flex-col gap-4 lg:flex-row">
                        <div className="flex-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Search evidence
                            </label>

                            <input
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
                            disabled={loading || !query.trim() || !projectId}
                            className="mt-auto h-12 rounded-xl bg-foreground px-7 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? "Searching..." : "Search evidence"}
                        </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <select
                            value={projectId}
                            onChange={(event) =>
                                setProjectId(event.target.value)
                            }
                            disabled={loadingProjects}
                            className="h-11 rounded-xl border bg-background px-3 text-sm"
                        >
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                    {project.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={siteId}
                            onChange={(event) =>
                                setSiteId(event.target.value)
                            }
                            className="h-11 rounded-xl border bg-background px-3 text-sm"
                        >
                            <option value="">All sites</option>

                            {sites.map((site) => (
                                <option key={site.id} value={site.id}>
                                    {site.name}
                                </option>
                            ))}
                        </select>

                        <select
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
                                setVerifiedOnly(event.target.checked)
                            }
                            className="h-4 w-4"
                        />
                        Show verified evidence only
                    </label>
                </form>

                {error && (
                    <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                        {error}
                    </div>
                )}

                <section className="mt-12">
                    <div className="flex items-end justify-between border-b pb-4">
                        <div>
                            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                Search results
                            </p>

                            <h2 className="mt-2 text-2xl font-semibold">
                                {results.length > 0
                                    ? `${results.length} evidence matches`
                                    : "No results yet"}
                            </h2>
                        </div>

                        {mode && (
                            <span className="rounded-full border px-3 py-1.5 text-xs font-medium">
                                {mode}
                            </span>
                        )}
                    </div>

                    {results.length === 0 && !loading ? (
                        <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
                            <p className="text-sm font-medium">
                                Search your field evidence
                            </p>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Try phrases such as “riverbank cleanup”,
                                “plantation activity”, or “waste near the
                                river”.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {results.map((hit) => (
                                <article
                                    key={hit.asset.id}
                                    className="overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
                                >
                                    <div className="aspect-[4/3] bg-muted">
                                        <img
                                            src={hit.asset.secureUrl}
                                            alt={
                                                hit.asset.aiCaption ??
                                                "Field evidence"
                                            }
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
                                            <span className="text-xs text-muted-foreground">
                                                Match{" "}
                                                {Math.round(
                                                    hit.score * 100
                                                )}
                                                %
                                            </span>

                                            <span className="text-xs text-muted-foreground">
                                                {hit.matchedBy.join(" + ")}
                                            </span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}