"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FolderOpen,
  Image as ImageIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { apiFetch, errorMessage } from "@/lib/api";
import { PROJECT_COVER, cloudinaryVariant } from "@/lib/cloudinary-url";

type Project = {
  id: string;
  name: string;
  description?: string | null;
};

type ProjectOverview = Project & {
  sites?: Array<{
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
  }>;
  totals?: {
    assets?: number;
    verified?: number;
    comparisons?: number;
  };
};

type ProjectCardData = {
  project: Project;
  overview?: ProjectOverview;
  previewImage?: string;
};

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectData, setProjectData] = useState<
    Record<string, ProjectCardData>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      let projectList: Project[];

      try {
        projectList =
          (await apiFetch<Project[]>(
            "/api/projects",
            { cache: "no-store" },
            "Failed to load projects."
          )) ?? [];
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to load projects."));
          setLoading(false);
        }

        return;
      }

      if (cancelled) return;

      // Show the list now; each card fills in as its own details arrive.
      setProjects(projectList);
      setError("");
      setLoading(false);

      for (const project of projectList) {
        loadCard(project);
      }
    }

    async function loadCard(project: Project) {
      const [overview, latest] = await Promise.all([
        // A card stays visible with whatever part of it could be loaded.
        apiFetch<ProjectOverview>(`/api/projects/${project.id}`, {
          cache: "no-store",
        }).catch(() => undefined),

        apiFetch<Array<{ secureUrl: string }>>(
          `/api/assets?projectId=${project.id}&limit=1`,
          { cache: "no-store" }
        ).catch(() => []),
      ]);

      if (cancelled) return;

      setProjectData((current) => ({
        ...current,
        [project.id]: {
          project,
          overview,
          previewImage: latest?.[0]?.secureUrl,
        },
      }));
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#172019]">
      {/* Header */}
      <header className="border-b border-black/[0.07] bg-[#f7f8f6]">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#172019] text-white">
              <Sparkles className="h-4 w-4" />
            </div>

            <div className="text-left">
              <p className="text-[15px] font-semibold tracking-[-0.02em]">
                FieldProof
              </p>

              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Field evidence
              </p>
            </div>
          </Link>

          <span className="text-sm text-muted-foreground">
            Projects
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1440px] px-6 pb-14 pt-16 lg:px-10 lg:pb-16 lg:pt-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Field documentation
            </p>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[68px]">
              Projects and evidence,
              <br />
              <span className="text-[#68746d]">
                in one place.
              </span>
            </h1>
          </div>

          <div className="max-w-md lg:justify-self-end">
            <p className="text-base leading-7 text-muted-foreground">
              Review field photographs, track locations, verify
              evidence, compare changes and prepare reports for
              each project.
            </p>

            <div className="mt-5 flex items-center gap-2 text-sm text-[#314238]">
              <FolderOpen className="h-4 w-4" />

              <span>
                {loading
                  ? "Loading projects..."
                  : error
                    ? "Projects unavailable"
                    : `${projects.length} ${projects.length === 1
                    ? "project"
                    : "projects"
                  }`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="mx-auto max-w-[1440px] px-6 pb-20 lg:px-10">
        <div className="mb-7 flex items-end justify-between border-b border-black/[0.08] pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Your projects
            </p>

            <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">
              Select a project
            </h2>
          </div>

          <span className="hidden text-xs text-muted-foreground sm:block">
            Choose a project to continue
          </span>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((item) => (
              <ProjectCardSkeleton key={item} />
            ))}
          </div>
        ) : error ? (
          <Card
            role="alert"
            className="rounded-xl border-red-200 bg-white p-12 text-center shadow-none"
          >
            <h3 className="text-lg font-semibold">
              Projects could not be loaded
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {error}
            </p>

            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setAttempt((current) => current + 1);
              }}
              className="mx-auto mt-6 rounded-lg bg-[#172019] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#29382f]"
            >
              Try again
            </button>
          </Card>
        ) : projects.length === 0 ? (
          <Card className="rounded-xl border-dashed bg-white p-12 text-center shadow-none">
            <FolderOpen className="mx-auto h-7 w-7 text-muted-foreground" />

            <h3 className="mt-4 text-lg font-semibold">
              No projects yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Projects will appear here once they have been
              created.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {projects.map((project) => {
              const data = projectData[project.id];

              return (
                <ProjectCard
                  key={project.id}
                  project={project}
                  overview={data?.overview}
                  previewImage={data?.previewImage}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* What FieldProof covers */}
      <section className="border-y border-black/[0.07] bg-white">
        <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                FieldProof
              </p>

              <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em]">
                Keep the field record together from collection to report.
              </h2>
            </div>

            <div className="grid border-y border-black/[0.08] sm:grid-cols-2">
              <FeatureItem
                icon={<ImageIcon className="h-4 w-4" />}
                title="Field evidence"
                description="Keep photographs organized by project, site and phase."
              />

              <FeatureItem
                icon={<Waves className="h-4 w-4" />}
                title="Change over time"
                description="Compare before and after evidence from field locations."
              />

              <FeatureItem
                icon={<Search className="h-4 w-4" />}
                title="Evidence search"
                description="Find relevant photographs using natural language."
              />

              <FeatureItem
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Verification and reports"
                description="Trace evidence and turn project findings into reports."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#f7f8f6]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span>FieldProof</span>
          <span>
            Field evidence · Verification · Impact reporting
          </span>
        </div>
      </footer>
    </main>
  );
}

function ProjectCard({
  project,
  overview,
  previewImage,
}: {
  project: Project;
  overview?: ProjectOverview;
  previewImage?: string;
}) {
  const assets = overview?.totals?.assets ?? 0;
  const verified = overview?.totals?.verified ?? 0;
  const sites = overview?.sites?.length ?? 0;

  return (
    <Card className="group overflow-hidden rounded-xl border-black/[0.09] bg-white p-0 shadow-none transition-colors duration-200 hover:border-black/[0.18]">
      {/* Image */}
      <div className="relative aspect-[16/8.5] overflow-hidden bg-[#e9ece8]">
        {previewImage ? (
          // The project name is the heading below, so the cover is decorative.
          <img
            src={cloudinaryVariant(previewImage, PROJECT_COVER)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-black/[0.08] bg-white/70 text-[#526158]">
              <ImageIcon className="h-6 w-6" />
            </div>
          </div>
        )}

        <div className="absolute left-4 top-4">
          <Badge
            variant="outline"
            className="rounded-full border-white/70 bg-white/90 text-xs font-medium text-[#314238] shadow-none backdrop-blur-sm"
          >
            Active project
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <h3 className="text-2xl font-semibold tracking-[-0.035em]">
              {project.name}
            </h3>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {project.description ||
                "Field evidence collection and project documentation."}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 border-y border-black/[0.07] py-4">
          <Stat
            value={assets}
            label={assets === 1 ? "asset" : "assets"}
          />

          <Stat
            value={sites}
            label={sites === 1 ? "site" : "sites"}
            bordered
          />

          <Stat
            value={verified}
            label="verified"
            bordered
          />
        </div>

        {/* Sites */}
        {overview?.sites && overview.sites.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Field sites
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {overview.sites.slice(0, 3).map((site) => (
                <span
                  key={site.id}
                  className="text-xs text-[#4d5b53]"
                >
                  {site.name}
                </span>
              ))}

              {overview.sites.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{overview.sites.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Action */}
        <Link
          href={`/project/${project.id}`}
          className="mt-7 flex w-full items-center justify-between border-t border-black/[0.07] pt-5 text-sm font-medium text-[#314238]"
        >
          <span>Open project</span>

          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.1] transition-all group-hover:border-[#172019] group-hover:bg-[#172019] group-hover:text-white">
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </Card>
  );
}

function Stat({
  value,
  label,
  bordered = false,
}: {
  value: number;
  label: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={
        bordered
          ? "border-l border-black/[0.07] pl-4"
          : ""
      }
    >
      <p className="text-lg font-semibold tracking-[-0.025em]">
        {value}
      </p>

      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl border-black/[0.08] bg-white p-0 shadow-none">
      <div className="aspect-[16/8.5] animate-pulse bg-[#e9ece8]" />

      <div className="space-y-5 p-7">
        <div className="space-y-3">
          <div className="h-7 w-3/5 animate-pulse bg-[#e9ece8]" />
          <div className="h-4 w-full animate-pulse bg-[#e9ece8]" />
          <div className="h-4 w-4/5 animate-pulse bg-[#e9ece8]" />
        </div>

        <div className="grid grid-cols-3 border-y border-black/[0.07] py-4">
          <div className="h-9 animate-pulse bg-[#e9ece8]" />
          <div className="mx-4 h-9 animate-pulse bg-[#e9ece8]" />
          <div className="h-9 animate-pulse bg-[#e9ece8]" />
        </div>

        <div className="h-10 animate-pulse bg-[#e9ece8]" />
      </div>
    </Card>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4 border-b border-black/[0.07] p-6 last:border-b-0 sm:nth-[2]:border-b sm:nth-[3]:border-b-0 sm:nth-[4]:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f0f3ef] text-[#314238]">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-semibold">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}