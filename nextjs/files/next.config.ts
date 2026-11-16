import { existsSync } from "node:fs";
import type { NextConfig } from "next";

function parseOrigins(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => {
      try {
        return new URL(origin.trim()).hostname;
      } catch {
        return origin
          .trim()
          .replace(/^https?:\/\//, "")
          .split(":")[0]
          .split("/")[0];
      }
    })
    .filter(Boolean);
}

/**
 * Platform-injected source-location loader (adds data-source-* attributes to JSX in dev).
 * It deliberately lives in the sandbox image rather than the template — see the COPY line
 * in deploy/grand-escape-sandbox/Dockerfile. Init only copies files/ into the workspace,
 * so this path is invisible to the user project.
 * Outside the sandbox (running this template locally) the file does not exist, in which
 * case it is fully disabled: otherwise a failed loader resolution would kill the dev server.
 */
const SOURCE_LOADER = "/opt/jizao/loader/jizao-source-loader.js";
const useSourceLoader = existsSync(SOURCE_LOADER);

const nextConfig: NextConfig = {
  output: "standalone",
  // Next.js 16 blocks cross-origin HMR WebSocket unless origin is allowed.
  // Required when preview runs on 127.0.0.1:PORT and parent page is on another origin.
  allowedDevOrigins: [
    "localhost",
    "0.0.0.0",
    ...parseOrigins(process.env.PREVIEW_WEBSITE_HOST),
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  // Turbopack branch (used by `next dev` without --webpack); it shares the same
  // loader file with the webpack branch below and produces identical data-source-*.
  //
  // This key must exist unconditionally, even as an empty object when the loader is
  // disabled: as long as webpack() is present above, Next exits(1) under the default
  // Turbopack with "using Turbopack, with a `webpack` config and no `turbopack` config".
  turbopack: useSourceLoader
    ? {
        rules: {
          "*.{tsx,jsx}": {
            // foreign means node_modules; development matches the dev argument in the webpack branch.
            // No browser restriction: Server Components must be instrumented too.
            condition: { all: [{ not: "foreign" }, "development"] },
            loaders: [SOURCE_LOADER],
          },
        },
      }
    : {},

  webpack(config, { dev }) {
    // Do not restrict to !isServer: App Router Server Components only appear on server/edge-server
    if (dev && useSourceLoader) {
      // enforce: 'pre' is required: multiple loaders on the same module run back to front,
      // and the built-in next-swc-loader compiles JSX into _jsxDEV calls first, after which
      // the AST no longer contains JSXOpeningElement. Only the pre stage sees raw JSX source.
      // (Not needed for the Turbopack branch, whose custom loader naturally runs before SWC.)
      config.module.rules.unshift({
        enforce: "pre",
        test: /\.(tsx|jsx)$/,
        exclude: /node_modules/,
        use: [SOURCE_LOADER],
      });
    }
    return config;
  },
};

export default nextConfig;
