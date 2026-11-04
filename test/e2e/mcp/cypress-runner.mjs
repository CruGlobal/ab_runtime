// Child process used by cypress-mcp.mjs.
// Runs Cypress through its Module API and prints a compact JSON summary on
// a single line that starts with RESULT_MARKER. Cypress writes a lot to
// stdout, so this has to live outside the MCP server's stdio.
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cypress from "cypress";

const RESULT_MARKER = "__AB_CYPRESS_RESULT__";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const project = path.resolve(repoRoot, "test", "e2e");

// Same env as `env-cmd` gives the npm scripts.
dotenv.config({ path: path.join(repoRoot, ".env") });

async function main() {
   const opts = JSON.parse(process.argv[2] || "{}");

   const results = await cypress.run({
      project,
      configFile: opts.configFile || "cypress.config.mjs",
      spec: opts.spec,
      browser: opts.browser || "electron",
      headed: !!opts.headed,
      quiet: true,
   });

   let summary;
   if (results.status === "failed") {
      summary = {
         ok: false,
         error: results.message,
         failures: results.failures,
      };
   } else {
      summary = {
         ok: results.totalFailed === 0,
         totalTests: results.totalTests,
         totalPassed: results.totalPassed,
         totalFailed: results.totalFailed,
         totalPending: results.totalPending,
         totalSkipped: results.totalSkipped,
         durationMs: results.totalDuration,
         specs: results.runs.map((run) => ({
            spec: run.spec.relative,
            stats: {
               passes: run.stats.passes,
               failures: run.stats.failures,
               pending: run.stats.pending,
               skipped: run.stats.skipped,
            },
            failedTests: run.tests
               .filter((t) => t.state === "failed")
               .map((t) => ({
                  title: t.title.join(" > "),
                  error: t.displayError,
               })),
            screenshots: run.screenshots.map((s) => s.path),
         })),
      };
   }

   console.log(RESULT_MARKER + JSON.stringify(summary));
}

main()
   .then(() => process.exit(0))
   .catch((err) => {
      console.log(
         RESULT_MARKER + JSON.stringify({ ok: false, error: String(err) }),
      );
      process.exit(1);
   });
