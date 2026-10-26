import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @netlify/blobs must stay external so it can see the credentials Netlify injects into the function.
  // Page reads pass runtimeFetch (lib/runtime-fetch.ts) so Next's patched fetch cannot cache or stall them.
  serverExternalPackages: ["@netlify/blobs"],
  experimental: {
    serverActions: {
      // Delivery photos from the driver's phone.
      bodySizeLimit: "25mb",
    },
  },
  async headers() {
    const noStore = [{ key: "Cache-Control", value: "no-store" }];
    return [
      { source: "/api/:path*", headers: noStore },
      { source: "/d/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
