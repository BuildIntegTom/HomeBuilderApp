import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-konva's imperative Konva-node reconciliation doesn't play well with
  // React 18 StrictMode's dev-only double-invoked renders (intermittently
  // dropped a node during rapid double-render reconciliation) — this only
  // affects development-mode behavior, not production.
  reactStrictMode: false,
};

export default nextConfig;
