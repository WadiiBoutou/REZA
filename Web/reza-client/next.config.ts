import type { NextConfig } from "next";

// Prefer next.config.js if both exist — keep this in sync.
const nextConfig: NextConfig = {
  env: {
    TZ: "Africa/Casablanca",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    const baseBackendUrl = backendUrl.replace(/\/api\/?$/, "");

    return [
      {
        source: "/api/:path*",
        destination: `${baseBackendUrl}/api/:path*`,
      },
      {
        // API client uses /backend-api as base URL — proxy to backend
        source: "/backend-api/:path*",
        destination: `${baseBackendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${baseBackendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
