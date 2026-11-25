/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Type-check and lint run in CI/locally; skipped in the low-memory host build.
  typescript: { ignoreBuildErrors: process.env.SKIP_BUILD_CHECKS === "1" },
  eslint: { ignoreDuringBuilds: process.env.SKIP_BUILD_CHECKS === "1" },
  productionBrowserSourceMaps: false,
  experimental: { webpackMemoryOptimizations: true, cpus: 1, workerThreads: false },
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};
export default nextConfig;
