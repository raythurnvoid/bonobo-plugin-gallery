import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The host publishes exactly the three files named in bonobo.plugin.json
// (dist/frontend/index.html + assets/index.js + assets/index.css), so the build
// must emit fixed, unhashed names and a single JS chunk.
export default defineConfig({
	plugins: [react()],
	base: "./",
	resolve: {
		// Keep React's API for source compatibility, but do not ship the full React runtime in this small iframe.
		alias: [
			{ find: "react/jsx-dev-runtime", replacement: "preact/jsx-dev-runtime" },
			{ find: "react/jsx-runtime", replacement: "preact/jsx-runtime" },
			{ find: "react-dom/client", replacement: "preact/compat/client" },
			{ find: "react-dom", replacement: "preact/compat" },
			{ find: "react", replacement: "preact/compat" },
		],
	},
	build: {
		outDir: "dist/frontend",
		// Published plugin source stays readable and reviewable.
		minify: false,
		rollupOptions: {
			output: {
				entryFileNames: "assets/index.js",
				chunkFileNames: "assets/[name].js",
				assetFileNames: "assets/index[extname]",
				// Guarantees a single JS chunk (rolldown-vite's replacement for
				// the deprecated inlineDynamicImports: true).
				codeSplitting: false,
			},
		},
	},
});
