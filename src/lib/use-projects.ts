"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { apiFetch, errorMessage } from "@/lib/api";

export type ProjectSummary = {
    id: string;
    name: string;
    description?: string | null;
};

/**
 * Loads the project list and picks the active project: the `?projectId=` the page was opened
 * with when that project exists, otherwise the first one.
 *
 * Reads the query string, so the component using it must render inside `<Suspense>`.
 */
export function useProjects() {
    const requested = useSearchParams().get("projectId") ?? "";

    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [projectId, setProjectId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        apiFetch<ProjectSummary[]>(
            "/api/projects",
            undefined,
            "Failed to load projects"
        )
            .then((data) => {
                if (cancelled) return;

                const list = data ?? [];
                const wanted = list.some((project) => project.id === requested)
                    ? requested
                    : (list[0]?.id ?? "");

                setProjects(list);
                setProjectId((current) => current || wanted);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(errorMessage(err, "Failed to load projects"));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [requested]);

    return { projects, projectId, setProjectId, loading, error };
}
