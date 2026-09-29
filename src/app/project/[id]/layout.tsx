import type { Metadata } from "next";

export const metadata: Metadata = { title: "Project" };

export default function ProjectLayout({ children }: LayoutProps<"/project/[id]">) {
  return children;
}
