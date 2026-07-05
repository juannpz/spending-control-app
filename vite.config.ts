import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const appVersion = env.VITE_APP_VERSION || Date.now().toString();

    return {
        plugins: [
            react(),
            tailwindcss(),
            {
                name: "inject-sw-version",
                closeBundle() {
                    const swPath = path.resolve(__dirname, "dist", "sw.js");
                    if (!fs.existsSync(swPath)) return;
                    let content = fs.readFileSync(swPath, "utf8");
                    content = content.replace(/__APP_VERSION__/g, appVersion);
                    fs.writeFileSync(swPath, content);
                },
            },
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    };
});
