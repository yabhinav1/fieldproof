import type { Metadata } from "next";

import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";

import curated from "../../../data/curated.json";

export const metadata: Metadata = {
  title: "Photo credits",
  description:
    "Authors and licences of the demo photographs shown in FieldProof.",
};

type Credit = {
  site: string;
  phase: string;
  title: string;
  page: string;
  license: string;
  artist: string;
};

const LICENCE_LINKS: Record<string, string> = {
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
  "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
  "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
  "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
};

const SITE_LABELS: Record<string, string> = {
  "site-a": "Site A",
  "site-b": "Site B",
  "site-c": "Site C",
};

const credits = curated as Credit[];

/** File titles end in an extension and use underscores; neither helps a reader. */
function readableTitle(title: string) {
  return title.replace(/\.(jpe?g|png|webp)$/i, "").replaceAll("_", " ");
}

export default function CreditsPage() {
  const sites = [...new Set(credits.map((credit) => credit.site))].sort();

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#172019]">
      <AppHeader />

      <section className="mx-auto max-w-[1100px] px-6 pb-20 pt-14 lg:px-10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Photo credits
        </p>

        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl">
          The photographs in this demo
        </h1>

        <div className="mt-5 max-w-2xl space-y-3 text-base leading-7 text-muted-foreground">
          <p>
            The demo project uses {credits.length} openly licensed
            photographs from Wikimedia Commons. They stand in for the field
            photos an organisation would upload itself.
          </p>

          <p>
            The project, its sites and its dates are illustrative. The
            photographers, and the people and places shown, have no
            connection to FieldProof and do not endorse it. Photos are
            resized and cropped for display; each one links to its original.
          </p>
        </div>

        {sites.map((site) => {
          const photos = credits.filter((credit) => credit.site === site);

          return (
            <section key={site} className="mt-12">
              <div className="flex items-end justify-between border-b border-black/[0.08] pb-3">
                <h2 className="text-lg font-semibold tracking-[-0.025em]">
                  {SITE_LABELS[site] ?? site}
                </h2>

                <span className="text-xs text-muted-foreground">
                  {photos.length} photographs
                </span>
              </div>

              <ul className="divide-y divide-black/[0.07] border-b border-black/[0.07] bg-white">
                {photos.map((photo) => (
                  <li
                    key={photo.page}
                    className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <div className="min-w-0">
                      <a
                        href={photo.page}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {readableTitle(photo.title)}
                      </a>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        by {photo.artist}
                      </p>
                    </div>

                    {LICENCE_LINKS[photo.license] ? (
                      <a
                        href={LICENCE_LINKS[photo.license]}
                        target="_blank"
                        rel="noopener noreferrer license"
                        className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-[#172019] hover:underline"
                      >
                        {photo.license}
                      </a>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {photo.license}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </section>

      <AppFooter />
    </main>
  );
}
