/** @type {import('next').NextConfig} */
const nextConfig = {
  // Rewrite API calls to backend (development)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/:path*`,
      },
    ];
  },

  // Ignore strict lint and build warnings for easy deployment
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  // Allow react-force-graph-2d canvas rendering
  transpilePackages: ["react-force-graph-2d", "force-graph", "three", "@react-three/fiber", "@react-three/drei"],

  // Webpack: handle canvas and 3d-force-graph's optional peer deps
  webpack(config) {
    config.externals = config.externals ?? [];
    if (Array.isArray(config.externals)) {
      config.externals.push({ canvas: "canvas" });
    }
    return config;
  },
};

export default nextConfig;
