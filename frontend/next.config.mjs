/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Anna OS bundle is emitted to <repo>/bundle. On Vercel, keep Next's default
  // in-project output so the deployment can locate the build artifacts.
  ...(process.env.VERCEL ? {} : { distDir: "../bundle" }),
  images: { unoptimized: true },
};
export default nextConfig;
