import type { NextConfig } from 'next';

// The browser only talks to the web origin and calls /api/* there. On Vercel, the top-level rewrite
// in vercel.json routes /api/* to the api service before Next sees it, so Next proxies only when
// API_URL is set or in local `pnpm dev` (Nest on :4000).
const API_URL = process.env.API_URL ?? (process.env.VERCEL ? undefined : 'http://localhost:4000');

const nextConfig: NextConfig = {
  async rewrites() {
    return API_URL ? [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }] : [];
  },
};

export default nextConfig;
