import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@modelcontextprotocol/sdk"],
};

export default nextConfig;
