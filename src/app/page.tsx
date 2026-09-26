"use client";

import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Trees,
  Waves,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const sites = [
  {
    name: "Ghat Cleanup",
    location: "Site A",
    photos: 18,
    phase: "After",
    image:
      "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Tree Plantation",
    location: "Site B",
    photos: 20,
    phase: "During",
    image:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=900&q=80",
  },
  {
    name: "Waste Segregation",
    location: "Site C",
    photos: 18,
    phase: "After",
    image:
      "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=900&q=80",
  },
];

const recentPhotos = [
  {
    title: "Riverbank cleanup",
    site: "Site A",
    date: "20 Aug 2026",
    image:
      "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "New plantation area",
    site: "Site B",
    date: "14 Aug 2026",
    image:
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Waste collection",
    site: "Site C",
    date: "08 Aug 2026",
    image:
      "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Riverbank volunteers",
    site: "Site A",
    date: "02 Aug 2026",
    image:
      "https://images.unsplash.com/photo-1559027615-cd4628902d4a?auto=format&fit=crop&w=800&q=80",
  },
];

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-[#172019]">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#f7f8f6]/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-[1500px] items-center justify-between px-6 lg:px-10">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172019] text-white">
                <Sparkles className="h-4 w-4" />
              </div>

              <div className="text-left">
                <p className="text-[15px] font-semibold tracking-[-0.02em]">
                  FieldProof
                </p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Impact evidence
                </p>
              </div>
            </button>

            {/* Navigation */}
            <nav className="hidden items-center gap-1 md:flex">
              <Button
                variant="secondary"
                className="rounded-lg bg-white px-4 text-sm shadow-sm"
                onClick={() => router.push("/")}
              >
                Overview
              </Button>

              <Button
                variant="ghost"
                className="rounded-lg px-4 text-sm text-muted-foreground"
                onClick={() => router.push("/gallery")}
              >
                Gallery
              </Button>

              <Button
                variant="ghost"
                className="rounded-lg px-4 text-sm text-muted-foreground"
                onClick={() => router.push("/comparison")}
              >
                Comparison
              </Button>

              <Button
                variant="ghost"
                className="rounded-lg px-4 text-sm text-muted-foreground"
                onClick={() => router.push("/search")}
              >
                Search
              </Button>

              <Button
                variant="ghost"
                className="rounded-lg px-4 text-sm text-muted-foreground"
                disabled
              >
                Map
              </Button>

              <Button
                variant="ghost"
                className="rounded-lg px-4 text-sm text-muted-foreground"
                onClick={() => router.push("/report")}
              >
                Report
              </Button>
            </nav>
          </div>

          {/* Search */}
          <Button
            variant="outline"
            className="hidden h-10 gap-2 rounded-xl border-black/[0.08] bg-white px-3 text-muted-foreground md:flex"
            onClick={() => router.push("/search")}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm">Search evidence</span>
            <kbd className="ml-4 rounded-md bg-[#f2f3f1] px-1.5 py-0.5 text-[10px]">
              /
            </kbd>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-[1500px] px-6 py-8 lg:px-10 lg:py-10">
        {/* Project heading */}
        <section className="mb-10">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <span>Projects</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Riverbank Restoration</span>
              </div>

              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Green Yamuna Collective
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  Delhi, India
                </span>

                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  6 month project
                </span>

                <Badge
                  variant="outline"
                  className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  Active project
                </Badge>
              </div>
            </div>

            <Button
              className="w-fit rounded-xl bg-[#172019] px-5 text-white hover:bg-[#26332a]"
              onClick={() => router.push("/gallery")}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              View all evidence
            </Button>
          </div>
        </section>

        {/* Statistics */}
        <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Field assets"
            value="56"
            description="Photos collected"
            icon={<ImageIcon className="h-5 w-5" />}
            onClick={() => router.push("/gallery")}
          />

          <StatCard
            label="Project sites"
            value="3"
            description="Active restoration sites"
            icon={<MapPin className="h-5 w-5" />}
            onClick={() => router.push("/gallery")}
          />

          <StatCard
            label="Comparisons"
            value="18"
            description="Before / after pairs"
            icon={<ArrowUpRight className="h-5 w-5" />}
            onClick={() => router.push("/comparison")}
          />

          <StatCard
            label="Verified assets"
            value="51"
            description="Passed verification"
            icon={<ShieldCheck className="h-5 w-5" />}
            onClick={() => router.push("/gallery")}
          />
        </section>

        {/* Sites */}
        <section className="mb-12">
          <SectionHeading
            title="Project sites"
            description="Evidence collected across the three restoration locations."
            action="View gallery"
            onClick={() => router.push("/gallery")}
          />

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {sites.map((site) => (
              <Card
                key={site.location}
                onClick={() => router.push("/gallery")}
                className="group cursor-pointer overflow-hidden rounded-2xl border-black/[0.07] bg-white py-0 shadow-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.05]"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={site.image}
                    alt={site.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  <div className="absolute left-4 top-4">
                    <Badge className="rounded-full bg-white/90 text-[#172019] shadow-sm backdrop-blur hover:bg-white">
                      {site.location}
                    </Badge>
                  </div>

                  <div className="absolute bottom-4 right-4">
                    <Badge className="rounded-full bg-[#172019]/90 text-white backdrop-blur hover:bg-[#172019]">
                      {site.phase}
                    </Badge>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold tracking-[-0.02em]">
                        {site.name}
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Riverbank restoration site
                      </p>
                    </div>

                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Evidence</span>
                    <span className="font-medium">{site.photos} photos</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Bottom section */}
        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Recent evidence */}
          <Card className="rounded-2xl border-black/[0.07] bg-white p-6 shadow-none">
            <SectionHeading
              title="Recent field evidence"
              description="Latest media added to the project."
              action="Open gallery"
              onClick={() => router.push("/gallery")}
            />

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {recentPhotos.map((photo) => (
                <div
                  key={photo.title}
                  onClick={() => router.push("/gallery")}
                  className="group cursor-pointer"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                    <img
                      src={photo.image}
                      alt={photo.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-12">
                      <p className="text-xs font-medium text-white">
                        {photo.site}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 truncate text-sm font-medium">
                    {photo.title}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {photo.date}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Project activity */}
          <Card className="rounded-2xl border-black/[0.07] bg-[#172019] p-6 text-white shadow-none">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/50">
                  Project activity
                </p>

                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  Evidence at a glance
                </h2>
              </div>

              <Trees className="h-6 w-6 text-white/60" />
            </div>

            <div className="mt-8 space-y-6">
              <ActivityItem
                icon={<Waves className="h-4 w-4" />}
                title="Ghat cleanup"
                description="18 assets across before, during and after phases"
              />

              <ActivityItem
                icon={<Trees className="h-4 w-4" />}
                title="Tree plantation"
                description="20 field photos collected from Site B"
              />

              <ActivityItem
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Verification"
                description="51 of 56 assets currently pass checks"
              />
            </div>

            <Button
              className="mt-8 w-full rounded-xl bg-white text-[#172019] hover:bg-white/90"
              onClick={() => router.push("/gallery")}
            >
              Explore evidence
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer rounded-2xl border-black/[0.07] bg-white p-5 shadow-none transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0f3ef] text-[#314238]">
          {icon}
        </div>

        <span className="text-xs text-muted-foreground">Project</span>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
        {value}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </Card>
  );
}

function SectionHeading({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.025em]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <Button
        variant="ghost"
        onClick={onClick}
        className="hidden gap-1.5 text-sm text-muted-foreground sm:flex"
      >
        {action}
        <ArrowUpRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ActivityItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/70">
        {icon}
      </div>

      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/50">
          {description}
        </p>
      </div>
    </div>
  );
}