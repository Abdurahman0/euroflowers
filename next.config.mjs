/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR — prod build'ni ishlab turgan dev serverdan ajratish uchun
  // (ikkalasi bitta .next ustida ishlasa, build buziladi)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "loremflickr.com" }],
  },
};

export default nextConfig;
