import type { Metadata } from "next";

export const metadata: Metadata = { title: "Comparison" };

export default function ComparisonLayout({ children }: LayoutProps<"/comparison">) {
  return children;
}
