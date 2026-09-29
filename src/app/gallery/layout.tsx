import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryLayout({ children }: LayoutProps<"/gallery">) {
  return children;
}
