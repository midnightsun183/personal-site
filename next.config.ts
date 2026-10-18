import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plain files for Cloudflare's free static hosting: no server, so no server actions or image optimizer.
  output: "export",
  images: { unoptimized: true },
  // No cacheComponents / partialPrefetching: they do nothing for plain files and block `dynamicParams = false`.
  turbopack: {
    rules: {
      "*.css": {
        // Leave CSS Modules alone: running them through this rule turns them into global CSS and empties their class maps.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
