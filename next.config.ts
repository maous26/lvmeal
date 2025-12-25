import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'unsplash.com',
      },
      // Gustar.io recipe images from various sources
      {
        protocol: 'https',
        hostname: 'images.lecker.de',
      },
      {
        protocol: 'https',
        hostname: 'image.brigitte.de',
      },
      {
        protocol: 'https',
        hostname: 'www.feinschmecker.com',
      },
      {
        protocol: 'https',
        hostname: 'elavegan.com',
      },
      {
        protocol: 'https',
        hostname: '*.elavegan.com',
      },
      // Allow any https images as fallback for external recipe sources
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
