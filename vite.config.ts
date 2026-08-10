import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this repo from /comical/, not the domain root — but
// only in the Actions build, so local `npm run dev` is unaffected.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/comical/" : "/",
  plugins: [react()],
});
