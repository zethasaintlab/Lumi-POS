import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer must not be bundled by Next — it relies on Node
  // internals/fontkit that break when webpack traces it.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
