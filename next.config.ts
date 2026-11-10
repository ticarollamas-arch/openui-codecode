import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@opencode-ai/sdk"],
};
export default nextConfig;
