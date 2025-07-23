import fs from "fs";
import path from "path";
import { defineConfig } from "cypress";

export default defineConfig({
   defaultCommandTimeout: 12000,
   responseTimeout: 60000,
   video: false,
   e2e: {
      setupNodeEvents(on, config) {
         on("task", {
            listJsonDefs(dir) {
               //  const fullPath = path.resolve(process.cwd(), dir);
               const fullPath = path.resolve(dir);
               return fs
                  .readdirSync(fullPath)
                  .filter((f) => f.endsWith(".json"));
               // .map((f) => path.join(fullPath, f));
            },
         });
      },
   },
});
