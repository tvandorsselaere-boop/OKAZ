import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Pages HTML : toujours revalider auprès du serveur
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, must-revalidate' },
      ],
    },
  ],
};

export default nextConfig;
