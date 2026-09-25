import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // il motore sta in packages/engine, fuori da apps/web
  turbopack: { root: path.join(__dirname, "../..") },
  transpilePackages: ["@g1g10/engine"],
  serverExternalPackages: ["exceljs"],
  experimental: {
    // file Excel delle paghe: fino a qualche migliaio di righe
    serverActions: { bodySizeLimit: "10mb" },
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" }, // l'anteprima dei documenti è in un iframe della stessa app
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
