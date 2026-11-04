# AGENTS.md

Notes for AI coding agents (Claude Code, Cursor, Codex, etc.) working in this repo.

## Repo at a glance

- Docker Swarm deploy of the AppBuilder platform. Settings live in `.env` (gitignored).
- Dev stack: `./UP.sh` / `./Down.sh` (stack name `$STACKNAME`, default `ab`).
- Test stack: `npm run test:boot` / `npm run test:down` (stack name `$CYPRESS_STACK`, default `test_ab`).
  It uses `docker-compose.dev.yml` + `test/setup/test-compose.yml`.
- Both stacks bind the web UI to `$WEB_PORT` (8881), so run only one at a time.
- Cypress E2E suite lives in `test/e2e/`. See the scripts in `package.json`.

## Running E2E tests from the shell

```sh
npm run cypress:install     # once, downloads the Cypress binary
npm run test:boot           # deploy test_ab, wait ~1-2 min for services
npm run test:e2e -- --spec test/e2e/cypress/e2e/0001_portal_auth_login.cy.js
npm run test:reset          # wipe the test DB and re-run migrations
npm run test:down
```

Other configs: `test:e2e:app`, `test:e2e:ab-runtime`, `test:e2e:ab-designer`.

## MCP servers for browser testing

`.mcp.json` registers two project MCP servers. Claude Code asks you to approve
them the first time you start a session in this repo (check with `claude mcp list`).

| Server       | What it is                                                                  | Use it for                                                                                   |
| ------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ab-cypress` | Local server in `test/e2e/mcp/cypress-mcp.mjs`. Reads `.env`, targets `$CYPRESS_STACK`. | Running the real Cypress specs and getting structured pass/fail results.                     |
| `playwright` | Official `@playwright/mcp` (version pinned in `.mcp.json`).                 | Exploring the live UI: log in, click around, read the DOM, take screenshots, check console. |

### `ab-cypress` tools

| Tool           | Does                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------ |
| `stack_status` | Lists `test_ab_*` services and checks that `$CYPRESS_BASE_URL` answers. Call this first.  |
| `stack_up`     | `npm run test:boot`. Then poll `stack_status` until web returns HTTP 200.                 |
| `reset_db`     | `npm run test:reset`. Wipes the test DB only.                                             |
| `list_specs`   | Spec paths relative to `test/e2e/cypress/e2e`, with an optional filter.                    |
| `run_spec`     | Runs specs headless. Returns counts, failed test titles, errors and screenshot paths.     |

Check the server without an agent:

```sh
npm run mcp:smoke                          # status + list + runs the login spec
npm run mcp:smoke -- 0002_portal_work.cy.js
```

### Typical agent loops

1. **Debug a failing spec**: `stack_status` → `run_spec` → open the screenshot paths it returns
   with your file reader → fix → `run_spec` again.
2. **Write a new spec**: `reset_db` → use `playwright` to log in and find `data-cy` hooks
   (see below) → write the spec with those selectors and `cy.AuthLogin()` → `run_spec`.
3. **Check a UI change by hand**: `playwright` → `browser_navigate` to `$CYPRESS_BASE_URL` →
   log in → `browser_take_screenshot` / `browser_console_messages`.

### Playwright tips for this app

- Log in with the `.env` values `CYPRESS_USER_EMAIL` / `CYPRESS_USER_PASSWORD`. Never hardcode them.
- `browser_click`, `browser_fill_form`, etc. take a `target`. It can be a snapshot ref (`e25`)
  **or a CSS selector**, so use the same hooks as Cypress:
  `input[data-cy=portal_auth_login_form_email]`, `input[data-cy=portal_auth_login_form_password]`,
  `[data-cy=portal_auth_login_form_submit]`, `[data-cy=user_icon]`, `[data-cy=user_logout]`.
- List every hook on the page:
  `browser_evaluate` with `() => [...new Set([...document.querySelectorAll('[data-cy]')].map(e => e.dataset.cy))]`
- The app exposes `window.AB` (same object the `cy.Model*` commands use), so `browser_evaluate`
  can query data, e.g. `() => AB.applications().map(a => a.label)`.
- Page snapshots and console logs are saved as files in `test/e2e/.playwright-mcp/` (gitignored).
  Read them from there.
- Pass screenshot filenames as `test/e2e/.playwright-mcp/<name>.png`. A bare name is saved in
  the repo root.
- Webix UI loads after the page does. After login use `browser_wait_for` (text or ~3s) before
  reading the DOM.

### Gotchas

- **Specs change state.** Many specs call `cy.ResetDB()`, and `0001_portal_auth_login.cy.js`
  changes the admin password to `newpassword`. Before browsing with `playwright`, run `reset_db`
  or login fails with `invalid username/password`.
- **Cypress deletes old screenshots at the start of every run.** Read the screenshot paths from a
  failed `run_spec` before you run again.
- **First run after `test:boot` can fail** while services warm up (timeouts on elements that do
  exist). Run it once more before you debug.
- `cypress-mcp.mjs` talks MCP over stdout. Do not `console.log` in it; use `console.error`.
  Cypress itself runs in a child process (`cypress-runner.mjs`) for the same reason.
- Repo ESLint targets ES2020: no top-level `await` in `.mjs` files. Run `npx eslint <files>`.
