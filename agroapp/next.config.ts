import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Traces the real import graph and emits only the files the server actually
   * reaches, so the Docker runtime stage needs no node_modules at all. Without
   * it the build expects the whole dependency tree to be present at runtime,
   * which would multiply the image size and ship every devDependency.
   *
   * See agroapp/Dockerfile, which copies .next/standalone and runs server.js.
   */
  output: "standalone",
};

export default nextConfig;
