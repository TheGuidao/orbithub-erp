/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Isso ignora erros de tipo durante o build na Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Isso ignora erros de linting durante o build
    ignoreDuringBuilds: true,
  },
  devIndicators: {
    // Remove a bolinha do Node.js
    buildActivity: false,
  },
};

export default nextConfig;