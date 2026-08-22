import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Poster frames for the demo video. YouTube thumbnails only — nothing else
    // on the site loads a remote image.
    remotePatterns: [new URL("https://i.ytimg.com/vi/**")],
  },
};

export default nextConfig;
