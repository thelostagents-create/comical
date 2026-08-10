import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from the comical.pics custom domain root, not a /repo-name/
// subpath, so base is just "/" for both the Actions build and local dev.
export default defineConfig({
  base: "/",
  plugins: [react()],
});
