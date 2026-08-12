import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ['192.168.100.88'],

  // 5 min timeout — prevents proxy from killing long-running backend ops
  // (e.g. image upscale tile processing, AI model inference)
  experimental: {
    proxyTimeout: 300_000,
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
      {
        source: '/app/static/:path*',
        destination: 'http://127.0.0.1:8000/static/:path*',
      },
      {
        source: '/static/:path*',
        destination: 'http://127.0.0.1:8000/static/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:8000/uploads/:path*',
      },
      {
        source: '/temp/:path*',
        destination: 'http://127.0.0.1:8000/temp/:path*',
      }
    ]
  }
};

export default nextConfig;
