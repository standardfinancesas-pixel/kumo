/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kumo/shared'],
  images: { formats: ['image/webp'] },
};
export default nextConfig;
