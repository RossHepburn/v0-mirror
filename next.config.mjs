import { withWorkflow } from "workflow/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["ajv", "@vercel/oidc"],
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withWorkflow(nextConfig);
