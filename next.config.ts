import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "canvas", "@modelcontextprotocol/sdk"],
};

export default nextConfig;
