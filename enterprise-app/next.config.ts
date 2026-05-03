import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    // Native binary — webpack can't bundle .node files
    "@napi-rs/canvas",
    // Heavy CJS modules with internal worker/wasm files better required at runtime
    "tesseract.js",
    "pdf-parse",
    "pdfjs-dist",
    "mammoth",
  ],
};

export default nextConfig;
