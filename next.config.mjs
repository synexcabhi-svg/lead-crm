/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ["nodemailer"],
    serverActions: {
      allowedOrigins: (process.env.SERVER_ACTION_ORIGINS || "localhost:3000").split(","),
    },
  },
};

export default nextConfig;
