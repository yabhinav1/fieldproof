"use client";

import { Suspense, useEffect, useId, useState } from "react";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { apiFetch, errorMessage, jsonRequest } from "@/lib/api";
import { useProjects } from "@/lib/use-projects";

type Report = {
    id: string;
    projectId: string;
    title: string;
    createdAt: string;
    htmlUrl?: string;
};

/* The API accepts a title of 2 to 160 characters, or none. */
const TITLE_MIN = 2;
const TITLE_MAX = 160;

export default function ReportPage() {
    return (
        <Suspense fallback={null}>
            <ReportView />
        </Suspense>
    );
}

function ReportView() {
    const {
        projects,
        projectId,
        setProjectId,
        loading: loadingProjects,
        error: projectsError,
    } = useProjects();

    const [reports, setReports] = useState<Report[]>([]);
    const [title, setTitle] = useState("");
    const [includeFlagged, setIncludeFlagged] = useState(false);

    const [loadingReports, setLoadingReports] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState<Report | null>(null);
    const [error, setError] = useState("");

    const projectSelectId = useId();
    const titleInputId = useId();
    const titleHintId = useId();

    const trimmedTitle = title.trim();

    const titleTooShort =
        trimmedTitle.length > 0 && trimmedTitle.length < TITLE_MIN;

    useEffect(() => {
        if (!projectId) return;

        let cancelled = false;

        async function loadReports() {
            try {
                setLoadingReports(true);

                const data = await apiFetch<Report[]>(
                    `/api/reports?projectId=${encodeURIComponent(
                        projectId
                    )}`,
                    undefined,
                    "Failed to load reports"
                );

                if (!cancelled) {
                    setReports(data ?? []);
                }
            } catch (err) {
                if (!cancelled) {
                    setReports([]);

                    setError(
                        errorMessage(err, "Failed to load reports")
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingReports(false);
                }
            }
        }

        loadReports();

        return () => {
            cancelled = true;
        };
    }, [projectId]);

    /* Nothing from the previous project may linger under the new one. */
    function changeProject(id: string) {
        setProjectId(id);
        setReports([]);
        setGenerated(null);
        setError("");
    }

    async function generateReport() {
        if (!projectId || generating || titleTooShort) return;

        try {
            setGenerating(true);
            setGenerated(null);
            setError("");

            const report = await apiFetch<Report>(
                "/api/reports",
                jsonRequest("POST", {
                    projectId,
                    title: trimmedTitle || undefined,
                    includeFlagged,
                }),
                "Failed to generate report"
            );

            setReports((current) => [report, ...current]);
            setTitle("");

            /*
             * Generation takes long enough that a browser blocks a
             * window opened afterwards, so the report is offered as a link.
             */
            setGenerated(report);
        } catch (err) {
            setError(errorMessage(err, "Failed to generate report"));
        } finally {
            setGenerating(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f7f8f6]">
            <AppHeader
                projectId={projectId || undefined}
                current="report"
            />

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
                        project&apos;s field assets and comparisons.
                    </p>
                </div>

                <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label
                                htmlFor={projectSelectId}
                                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Project
                            </label>

                            <select
                                id={projectSelectId}
                                value={projectId}
                                onChange={(event) =>
                                    changeProject(event.target.value)
                                }
                                disabled={
                                    loadingProjects ||
                                    generating ||
                                    projects.length === 0
                                }
                                className="mt-2 h-12 w-full rounded-xl border bg-background px-3 text-sm disabled:opacity-60"
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
                        </div>

                        <div>
                            <label
                                htmlFor={titleInputId}
                                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                            >
                                Report title
                            </label>

                            <input
                                id={titleInputId}
                                value={title}
                                maxLength={TITLE_MAX}
                                aria-invalid={titleTooShort}
                                aria-describedby={
                                    titleTooShort ? titleHintId : undefined
                                }
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                placeholder="Enter report title (optional)"
                                className="mt-2 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                            />

                            {titleTooShort && (
                                <p
                                    id={titleHintId}
                                    className="mt-2 text-xs text-destructive"
                                >
                                    Use at least {TITLE_MIN} characters, or
                                    leave the title empty to have one
                                    written for you.
                                </p>
                            )}
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
                        type="button"
                        onClick={generateReport}
                        disabled={
                            generating || !projectId || titleTooShort
                        }
                        className="mt-6 h-12 rounded-xl bg-foreground px-6 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {generating
                            ? "Generating report..."
                            : "Generate impact report"}
                    </button>

                    {generating && (
                        <p
                            role="status"
                            className="mt-3 text-xs text-muted-foreground"
                        >
                            This can take a minute or two. Keep this page
                            open.
                        </p>
                    )}
                </div>

                {[projectsError, error].filter(Boolean).map((message) => (
                    <div
                        key={message}
                        role="alert"
                        className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
                    >
                        {message}
                    </div>
                ))}

                {generated && (
                    <div
                        role="status"
                        className="mt-6 flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                        <span>
                            <span className="font-medium">
                                {generated.title}
                            </span>{" "}
                            is ready.
                        </span>

                        <a
                            href={`/api/reports/${generated.id}/html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background hover:opacity-90"
                        >
                            Open report ↗
                        </a>
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

                    {loadingReports || loadingProjects ? (
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
                                    className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
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
                                        rel="noopener noreferrer"
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

            <AppFooter />
        </main>
    );
}
