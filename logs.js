#!/usr/bin/env node
//
// Logs.js
// Connect to the running containers and pipe their logs to the console or a file.
// --toFile [filepath]
//
require("dotenv").config();
const async = require("async");
const os = require("os");
const shell = require("shelljs");
shell.config.execPath = shell.which("node").toString();
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// These functions are overwriten if we choose to log to file
let log = (...args) => console.log(...args);
let logError = (...args) => console.error(...args);
let end = (signal) => closeDown(signal);

if (process.argv[2] == "--toFile") {
   const filepath = process.argv[3] ?? "logs/dockerLogs.txt";
   const directory = path.dirname(filepath);
   fs.mkdirSync(directory, { recursive: true });
   const stream = fs.createWriteStream(filepath);
   end = (signal) => {
      stream.end();
      closeDown(signal);
   };
   log = (text) => {
      stream.write(text, (err) => {
         if (err) {
            console.log(err);
         }
      });
   };
   logError = (text) => log(text);
}

var stdout = null;
if (process.env.PLATFORM === "podman") {
   stdout = shell.exec(
      `podman ps | awk '/${process.env.STACKNAME}/ {print $1}'`
   );
} else if (os.platform() == "win32") {
   // windows method of gathering the service names:
   stdout = shell
      .exec(
         `for /f "tokens=2" %a in ('docker service ls ^| findstr "${process.env.STACKNAME}_" ') do @echo %a`
      )
      .stdout.replace(/\r/g, "");
} else {
   // common unix method of gathering the service names:
   stdout = shell.exec(
      `docker service ls | grep "${process.env.STACKNAME}_" | awk '{ print $2 }'`
   ).stdout;
}

var allServiceIDs = stdout.split("\n");

var allServices = {};

var maxIDLength = -10;

var closeDown = (signal) => {
   // our process exit handler
   // be sure to kill all our sub processes

   allServiceIDs.forEach((id) => {
      if (allServices[id]) {
         log(`closing ${id} with ${signal}`);
         allServices[id].kill(signal);
      }
   });
};

function pad(text, length) {
   while (text.length < length) {
      text += " ";
   }
   return text;
}
/**
 * @param {string} id
 * @param {string} text
 */
function cleanText(id, text) {
   var lines = text.split("\n");
   var output = [];
   lines.forEach((line) => {
      if (line.length > 0) {
         var parts = line.split("|");
         if (parts.length > 1) {
            parts.shift();
         }
         output.push(`${pad(id, maxIDLength)} : ${parts.join("|")}`);
      }
   });

   return output.join("\n");
}

async.eachSeries(
   allServiceIDs,
   (id, cb) => {
      if (id == "") {
         cb();
         return;
      }

      // create a new process for logging the given service id
      const command = process.env.PLATFORM === "podman" ? "podman" : "docker";
      const options = ["service", "logs", "-f", "--tail", "50", id]; // `docker service logs -f ${id}`;
      if (command === "podman") options.shift(); // `podman logs -f ${id}`
      var logger = spawn(command, options, {
         // stdio: ["ignore", "ignore", "ignore"]
      });
      logger.stdout.on("data", (data) => {
         log(cleanText(id, data.toString()));
      });

      logger.stderr.on("data", (data) => {
         logError(cleanText(id, data.toString()));
      });

      if (id.length > maxIDLength) {
         maxIDLength = id.length;
      }

      allServices[id] = logger;
      cb();
   },
   (err) => {
      if (err) {
         logError(err);
         log();
         end("SIGINT");
         process.exit();
      }
   }
);

process.on("SIGINT", end);
process.on("SIGTERM", end);
