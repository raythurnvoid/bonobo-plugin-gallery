import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		// Tests use Preact's packaged runtime. The release build swaps only its implementation for readable source.
		alias: [
			{ find: "react/jsx-dev-runtime", replacement: "preact/jsx-dev-runtime" },
			{ find: "react/jsx-runtime", replacement: "preact/jsx-runtime" },
			{ find: "react-dom/client", replacement: "preact/compat/client" },
			{ find: "react-dom", replacement: "preact/compat" },
			{ find: "react", replacement: "preact/compat" },
		],
	},
	test: {
		environment: "happy-dom",
		restoreMocks: true,
	},
});
