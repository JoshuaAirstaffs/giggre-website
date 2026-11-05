import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  // Pins the workspace root explicitly — without this, Turbopack's
  // auto-detection can walk up past this repo and pick an unrelated
  // lockfile/directory as the project root on some hosts (seen on
  // Hostinger's build environment), which then breaks module resolution.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // `next build` spawns one static-generation worker process per CPU
    // core by default (see getNumberOfWorkers in next/dist/build/index.js).
    // Hostinger's build container reports a high core count that doesn't
    // match its actual memory budget, so the default spawned enough worker
    // processes to get OOM-killed (SIGABRT) during prerendering. Capping it
    // keeps worker count sane regardless of what the host reports.
    cpus: 2,
  },
};

export default nextConfig;
