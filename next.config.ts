import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // next dev recree sinon un AGENTS.md a la racine a chaque demarrage.
  agentRules: false,
};

export default nextConfig;
