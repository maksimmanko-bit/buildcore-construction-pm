import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/buildcore-construction-pm/",
  plugins: [react()],
  server: {
    port: 5174,
  },
});
