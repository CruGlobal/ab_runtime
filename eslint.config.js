const js = require("@eslint/js");
const eslintConfigPrettier = require("eslint-config-prettier/flat");
const eslintPluginCypress = require("eslint-plugin-cypress");
const eslintPluginPrettier = require("eslint-plugin-prettier");
const globals = require("globals");

const cypressRecommended = eslintPluginCypress.configs.recommended;

module.exports = [
   {
      ignores: [
         "assets/dependencies/**/*.js",
         "assets/js/**",
         "**/node_modules/**",
      ],
   },
   js.configs.recommended,
   {
      ...cypressRecommended,
      plugins: {
         ...cypressRecommended.plugins,
         prettier: eslintPluginPrettier,
      },
      languageOptions: {
         ...cypressRecommended.languageOptions,
         globals: {
            ...cypressRecommended.languageOptions.globals,
            ...globals.node,
            webix: "readonly",
            $$: "readonly",
         },
         ecmaVersion: 2020,
         sourceType: "module",
      },
      rules: {
         ...cypressRecommended.rules,
         "prettier/prettier": [
            "error",
            {
               arrowParens: "always",
               endOfLine: "lf",
               printWidth: 80,
               tabWidth: 3,
            },
         ],
         "no-console": 0,
      },
   },
   eslintConfigPrettier,
];
