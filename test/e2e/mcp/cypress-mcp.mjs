#!/usr/bin/env node
// Local MCP server that lets an AI agent drive this repo's Cypress suite
// against the test stack ($CYPRESS_STACK, default test_ab).
//
// Registered in /.mcp.json. Speaks MCP over stdio, so NOTHING in this file
// may write to stdout. Use console.error for debug output.
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const RESULT_MARKER = "__AB_CYPRESS_RESULT__";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const e2eDir = path.join(repoRoot, "test", "e2e");
const specRoot = path.join(e2eDir, "cypress", "e2e");

dotenv.config({ path: path.join(repoRoot, ".env") });
const STACK = process.env.CYPRESS_STACK || "test_ab";
const BASE_URL =
   process.env.CYPRESS_BASE_URL ||
   `http://localhost:${process.env.WEB_PORT || "8881"}`;

const CONFIG_FILES = {
   default: "cypress.config.mjs",
   app: "cypress.app.mjs",
   "ab-runtime": "cypress.ab_runtime.mjs",
   "ab-designer": "cypress.plugin.ab_designer.mjs",
};

/**
 * Run a command, capture output, never touch our stdout.
 * @returns {Promise<{code:number, stdout:string, stderr:string}>}
 */
function run(cmd, args, { timeoutMs = 120000 } = {}) {
   return new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd: repoRoot, env: process.env });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d));
      child.stderr.on("data", (d) => (stderr += d));
      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
      child.on("close", (code) => {
         clearTimeout(timer);
         resolve({ code, stdout, stderr });
      });
      child.on("error", (err) => {
         clearTimeout(timer);
         resolve({ code: -1, stdout, stderr: String(err) });
      });
   });
}

const tail = (s, n = 60) => s.split("\n").slice(-n).join("\n");
const text = (t) => ({
   content: [
      {
         type: "text",
         text: typeof t === "string" ? t : JSON.stringify(t, null, 2),
      },
   ],
});

function listSpecs(dir = specRoot) {
   const out = [];
   for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...listSpecs(full));
      else if (/\.cy\.[jt]s$/.test(entry.name))
         out.push(path.relative(specRoot, full));
   }
   return out.sort();
}

const server = new McpServer({ name: "ab-cypress", version: "1.0.0" });

server.registerTool(
   "stack_status",
   {
      description: `Check whether the AppBuilder test stack (${STACK}) is deployed and whether the web UI at ${BASE_URL} answers. Call this before running specs.`,
      inputSchema: {},
   },
   async () => {
      const services = await run("docker", [
         "service",
         "ls",
         "--filter",
         `name=${STACK}_`,
         "--format",
         "{{.Name}}\t{{.Replicas}}\t{{.Image}}",
      ]);
      let web;
      try {
         const res = await fetch(BASE_URL, { redirect: "manual" });
         web = `HTTP ${res.status}`;
      } catch (err) {
         web = `unreachable (${err.cause?.code || err.message})`;
      }
      return text({
         stack: STACK,
         baseUrl: BASE_URL,
         web,
         services: services.stdout.trim() || services.stderr.trim(),
      });
   },
);

server.registerTool(
   "stack_up",
   {
      description:
         "Deploy the test stack with `npm run test:boot` (docker stack deploy). Services take a few minutes to become ready; poll stack_status afterward.",
      inputSchema: {},
   },
   async () => {
      const r = await run("npm", ["run", "test:boot"], { timeoutMs: 600000 });
      return text({ exitCode: r.code, output: tail(r.stdout + r.stderr) });
   },
);

server.registerTool(
   "reset_db",
   {
      description:
         "Wipe the test stack DB back to its seed state and re-run migrations (`npm run test:reset`). Destroys all data in the test stack only.",
      inputSchema: {},
   },
   async () => {
      const r = await run("npm", ["run", "test:reset", STACK], {
         timeoutMs: 300000,
      });
      return text({ exitCode: r.code, output: tail(r.stdout + r.stderr) });
   },
);

server.registerTool(
   "list_specs",
   {
      description:
         "List Cypress spec files (paths relative to test/e2e/cypress/e2e).",
      inputSchema: {
         filter: z
            .string()
            .optional()
            .describe("Case-insensitive substring to match against the path"),
      },
   },
   async ({ filter }) => {
      let specs = listSpecs();
      if (filter) {
         const f = filter.toLowerCase();
         specs = specs.filter((s) => s.toLowerCase().includes(f));
      }
      return text(specs);
   },
);

server.registerTool(
   "run_spec",
   {
      description:
         "Run Cypress specs headless against the test stack and return a pass/fail summary with error messages and screenshot paths (open those with your file Read tool). Many specs call cy.ResetDB(), which wipes the test DB.",
      inputSchema: {
         spec: z
            .string()
            .optional()
            .describe(
               "Spec path or glob relative to test/e2e/cypress/e2e, e.g. '0001_portal_auth_login.cy.js'. Omit to run every spec the config includes (slow).",
            ),
         config: z
            .enum(Object.keys(CONFIG_FILES))
            .default("default")
            .describe("Which test/e2e config file to use"),
         browser: z
            .string()
            .optional()
            .describe("electron (default), chrome, firefox, ..."),
         headed: z.boolean().default(false),
         timeoutMinutes: z.number().default(30),
      },
   },
   async ({ spec, config, browser, headed, timeoutMinutes }) => {
      const opts = {
         configFile: CONFIG_FILES[config],
         spec: spec ? path.join(specRoot, spec) : undefined,
         browser,
         headed,
      };
      const r = await run(
         process.execPath,
         [path.join(here, "cypress-runner.mjs"), JSON.stringify(opts)],
         { timeoutMs: timeoutMinutes * 60000 },
      );
      const line = r.stdout
         .split("\n")
         .find((l) => l.startsWith(RESULT_MARKER));
      if (!line) {
         return {
            isError: true,
            ...text({
               error: "Cypress did not report results",
               exitCode: r.code,
               output: tail(r.stdout + r.stderr, 80),
            }),
         };
      }
      return text(JSON.parse(line.slice(RESULT_MARKER.length)));
   },
);

server
   .connect(new StdioServerTransport())
   .then(() =>
      console.error(
         `ab-cypress MCP ready (stack=${STACK}, baseUrl=${BASE_URL})`,
      ),
   );
