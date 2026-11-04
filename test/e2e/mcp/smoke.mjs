#!/usr/bin/env node


import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = process.argv[2] || "0001_portal_auth_login.cy.js";

async function call(client, name, args = {}) {
   console.log(`\n### ${name} ${JSON.stringify(args)}`);
   const res = await client.callTool({ name, arguments: args });
   console.log(res.content.map((c) => c.text).join("\n"));
   return res;
}

async function main() {
   const client = new Client({ name: "ab-cypress-smoke", version: "1.0.0" });
   await client.connect(
      new StdioClientTransport({
         command: process.execPath,
         args: [path.join(here, "cypress-mcp.mjs")],
      }),
   );

   const { tools } = await client.listTools();
   console.log("tools:", tools.map((t) => t.name).join(", "));

   await call(client, "stack_status");
   await call(client, "list_specs", { filter: "portal" });
   const res = await call(client, "run_spec", { spec });

   await client.close();
   const summary = JSON.parse(res.content[0].text);
   process.exit(res.isError || !summary.ok ? 1 : 0);
}

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
