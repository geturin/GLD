import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const dataFiles: Record<string, string> = {
  weapons: "weapons.json",
  characters: "characters.json",
  enemies: "enemies.json",
  weaponGridTemplates: "weaponGrids.json",
  statusEffectTaxonomy: "statusEffectTaxonomy.json",
};

function readRequestBody(request: import("node:http").IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "gld-data-editor-api",
      configureServer(server) {
        server.middlewares.use("/api/data", async (request, response, next) => {
          const kind = request.url?.replace(/^\/+/, "").split("?")[0] ?? "";
          const filename = dataFiles[kind];

          if (!filename) {
            next();
            return;
          }

          if (request.method !== "POST") {
            response.statusCode = 405;
            response.end("Only POST is supported.");
            return;
          }

          try {
            const body = await readRequestBody(request);
            const parsed = JSON.parse(body);
            const target = path.join(rootDir, "src", "data", filename);
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify({ ok: true, file: `src/data/${filename}` }));
          } catch (error) {
            response.statusCode = 400;
            response.end(error instanceof Error ? error.message : "Failed to save data.");
          }
        });
      },
    },
  ],
});
