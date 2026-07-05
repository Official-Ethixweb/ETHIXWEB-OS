import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [".up.railway.app"],
  },
  // Vite's default build output subfolder is "assets", which collides with
  // our backend's /assets (company Asset management) API route once both
  // are combined under one Vercel deployment with path-prefix routing.
  // Renaming it avoids that collision entirely rather than relying on
  // fragile rewrite-ordering tricks.
  build: {
    assetsDir: "static",
  },
  // Some CommonJS-authored deps (react-grid-layout's vendored drag helper)
  // assume a Node-style `process.env.NODE_ENV` exists, which Vite doesn't
  // polyfill in the browser by default — define it explicitly rather than
  // let those code paths throw "process is not defined" at runtime.
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
