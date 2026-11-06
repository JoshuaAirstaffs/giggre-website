import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets `next dev` serve hot reload (HMR) to other devices on the
  // local network, e.g. testing on a phone via http://192.168.x.x:3000.
  // Without it Next blocks the /_next/webpack-hmr websocket from non-localhost
  // origins. Has no effect on production builds.
  allowedDevOrigins: ["192.168.*.*"],
};

export default nextConfig;
