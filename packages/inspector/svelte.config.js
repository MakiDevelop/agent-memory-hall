import adapterNode from "@sveltejs/adapter-node";
import adapterStatic from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const useNode = process.env.AMH_STORE !== undefined || process.env.INSPECTOR_MODE === "server";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: useNode
      ? adapterNode()
      : adapterStatic({ fallback: "index.html" }),
  },
};

export default config;
