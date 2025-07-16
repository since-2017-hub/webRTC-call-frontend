import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  // server: {
  //   https: {
  //     key: fs.readFileSync("172.20.1.23-key.pem"),
  //     cert: fs.readFileSync("172.20.1.23.pem"),
  //   },
  //   host: true,
  // },
});
