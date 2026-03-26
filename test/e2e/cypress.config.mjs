import fs from "fs";
import path from "path";
import { defineConfig } from "cypress";

const webPort = process.env.WEB_PORT || "8088";
const baseUrl = process.env.CYPRESS_BASE_URL || `http://localhost:${webPort}`;


export default defineConfig({
   defaultCommandTimeout: 12000,
   responseTimeout: 60000,
   video: false,
   e2e: {
      baseUrl,
      setupNodeEvents(on /* , config */) {
         on("task", {
            listJsonDefs(dir) {
               const fullPath = path.resolve(dir);
               return fs
                  .readdirSync(fullPath)
                  .filter((f) => f.endsWith(".json"));
            },
         });
      },
   },
});
