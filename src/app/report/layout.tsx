import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports" };

export default function ReportLayout({ children }: LayoutProps<"/report">) {
  return children;
}
