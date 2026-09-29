import Link from "next/link";

export type AppSection =
  | "dashboard"
  | "gallery"
  | "comparison"
  | "search"
  | "report";

const sections: Array<{ key: AppSection; label: string; path: string }> = [
  { key: "dashboard", label: "Overview", path: "/project" },
  { key: "gallery", label: "Gallery", path: "/gallery" },
  { key: "comparison", label: "Comparison", path: "/comparison" },
  { key: "search", label: "Search", path: "/search" },
  { key: "report", label: "Reports", path: "/report" },
];

function sectionHref(section: (typeof sections)[number], projectId: string) {
  return section.key === "dashboard"
    ? `/project/${projectId}`
    : `${section.path}?projectId=${projectId}`;
}

/**
 * The one header every page shares. With a project it links the five
 * sections of that project to each other; without one it only leads home.
 */
export function AppHeader({
  projectId,
  current,
}: {
  projectId?: string;
  current?: AppSection;
}) {
  return (
    <header className="border-b border-black/[0.07] bg-[#f7f8f6] text-[#172019]">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-6 px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#172019] text-sm font-semibold text-white">
            F
          </span>

          <span className="text-left">
            <span className="block text-[15px] font-semibold tracking-[-0.02em]">
              FieldProof
            </span>

            <span className="block text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Field evidence
            </span>
          </span>
        </Link>

        {projectId ? (
          <nav
            aria-label="Project sections"
            className="-mx-2 flex items-center gap-1 overflow-x-auto px-2"
          >
            {sections.map((section) => {
              const active = section.key === current;

              return (
                <Link
                  key={section.key}
                  href={sectionHref(section, projectId)}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[#172019] font-medium text-white"
                      : "text-muted-foreground hover:bg-black/[0.05] hover:text-[#172019]"
                  }`}
                >
                  {section.label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <Link
            href="/"
            className="text-sm text-muted-foreground transition-colors hover:text-[#172019]"
          >
            Projects
          </Link>
        )}
      </div>
    </header>
  );
}
