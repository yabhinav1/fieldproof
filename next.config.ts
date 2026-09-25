import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / filesystem-heavy packages must not be bundled into route handlers.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "postgres", "cloudinary"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
