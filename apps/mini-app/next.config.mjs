const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isStaticExport = Boolean(basePath) || process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";
const apiProxyUrl = (process.env.API_PROXY_URL || process.env.API_PUBLIC_URL || "http://localhost:4000").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: true
  }
};

if (isStaticExport) {
  nextConfig.output = "export";
  nextConfig.basePath = basePath;
  nextConfig.assetPrefix = basePath || undefined;
} else {
  nextConfig.rewrites = async () => [
    {
      source: "/api/:path*",
      destination: `${apiProxyUrl}/api/:path*`
    }
  ];
}

export default nextConfig;
