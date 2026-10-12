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
};

export default nextConfig;
