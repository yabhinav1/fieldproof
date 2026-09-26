"use client";

import { useEffect, useState } from "react";

type Project = {
    id: string;
    name: string;
};

type Report = {
    id: string;
    projectId: string;
    title: string;
    createdAt: string;
    htmlUrl?: string;
};

export default function ReportPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectId, setProjectId] = useState("");
    const [reports, setReports] = useState<Report[]>([]);
    const [title, setTitle] = useState("");
    const [includeFlagged, setIncludeFlagged] = useState(false);

    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingReports, setLoadingReports] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadProjects() {
            try {
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
            setReports([]);
            return;
        }

        async function loadReports() {
            try {
                setLoadingReports(true);

                const response = await fetch(
                    `/api/reports?projectId=${projectId}`
                );

                if (!response.ok) {
                    throw new Error("Failed to load reports");
                }

                const result = await response.json();
                setReports(result.data ?? []);
            } catch (err) {
                setError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load reports"
                );
            } finally {
                setLoadingReports(false);
            }
        }

        loadReports();
    }, [projectId]);

    async function generateReport() {
        if (!projectId) return;

        try {
            setGenerating(true);
            setError("");

            const response = await fetch("/api/reports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    projectId,
                    title: title.trim() || undefined,
                    includeFlagged,
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.ok) {
                throw new Error(
                    result.error || "Failed to generate report"
                );
            }

            const report = result.data;

            setReports((current) => [report, ...current]);
            setTitle("");

            if (report.htmlUrl) {
                window.open(report.htmlUrl, "_blank");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to generate report"
            );
        } finally {
            setGenerating(false);
        }
    }

    return (
        <main className="min-h-screen bg-background">
            <section className="mx-auto max-w-6xl px-6 py-14">
                <div className="max-w-3xl">
                    <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                        Impact reporting
                    </p>

                    <h1 className="mt-4 text-5xl font-semibold tracking-tight">
                        Turn evidence into a report
                    </h1>

                    <p className="mt-4 text-lg leading-8 text-muted-foreground">
                        Generate an evidence-backed impact report from the
                        project's field assets and comparisons.
                    </p>
                </div>

                <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Project
                            </label>

                            <select
                                value={projectId}
                                onChange={(event) =>
                                    setProjectId(event.target.value)
                                }
                                disabled={loadingProjects}
                                className="mt-2 h-12 w-full rounded-xl border bg-background px-3 text-sm"
                            >
                                {projects.map((project) => (
                                    <option
                                        key={project.id}
                                        value={project.id}
                                    >
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Report title
                            </label>

                            <input
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                placeholder="Enter report title (optional)" className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>

                    <label className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={includeFlagged}
                            onChange={(event) =>
                                setIncludeFlagged(event.target.checked)
                            }
                            className="h-4 w-4"
                        />
                        Include flagged evidence
                    </label>

                    <button
                        onClick={generateReport}
                        disabled={generating || !projectId}
                        className="mt-6 h-12 rounded-xl bg-foreground px-6 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {generating
                            ? "Generating report..."
                            : "Generate impact report"}
                    </button>
                </div>

                {error && (
                    <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                        {error}
                    </div>
                )}

                <section className="mt-12">
                    <div className="border-b pb-4">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                            Report history
                        </p>

                        <h2 className="mt-2 text-2xl font-semibold">
                            {reports.length} generated{" "}
                            {reports.length === 1 ? "report" : "reports"}
                        </h2>
                    </div>

                    {loadingReports ? (
                        <div className="py-12 text-sm text-muted-foreground">
                            Loading reports...
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="mt-8 rounded-2xl border border-dashed p-12 text-center">
                            <p className="text-sm font-medium">
                                No reports generated yet
                            </p>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Generate your first evidence-backed impact
                                report above.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-8 space-y-4">
                            {reports.map((report) => (
                                <div
                                    key={report.id}
                                    className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <h3 className="font-medium">
                                            {report.title}
                                        </h3>

                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {new Date(
                                                report.createdAt
                                            ).toLocaleString()}
                                        </p>
                                    </div>

                                    <a
                                        href={`/api/reports/${report.id}/html`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium hover:bg-muted"
                                    >
                                        Open report ↗
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}