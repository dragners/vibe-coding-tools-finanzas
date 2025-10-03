#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import process from "process";

import { htmlToPlainText } from "../src/html-utils.js";
import { parsePerformance } from "../src/performance.js";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function printUsage() {
  console.log(`Usage: node scripts/debug-performance.js [options]\n\n` +
    `Options:\n` +
    `  --file <path>       HTML file to parse\n` +
    `  --url <url>         Download HTML from a Morningstar snapshot URL\n` +
    `  --out <path>        Write the JSON result to <path>\n` +
    `  --text <path>       Write the plain-text snapshot to <path>\n` +
    `  --block <path>      Write the detected performance block to <path>\n` +
    `  --log               Print debug log messages\n` +
    `  --help              Show this message\n`);
}

function parseArgs(argv) {
  const options = { log: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
        options.help = true;
        break;
      case "--log":
        options.log = true;
        break;
      case "--file":
      case "--url":
      case "--out":
      case "--text":
      case "--block": {
        const next = argv[i + 1];
        if (!next) {
          throw new Error(`Missing value for ${arg}`);
        }
        options[arg.slice(2)] = next;
        i += 1;
        break;
      }
      default:
        throw new Error(`Unknown option ${arg}`);
    }
  }
  return options;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }
  return await response.text();
}

async function loadHtml(options) {
  if (options.file) {
    const filePath = path.resolve(options.file);
    return await fs.readFile(filePath, "utf8");
  }
  if (options.url) {
    return await fetchHtml(options.url);
  }
  throw new Error("Provide either --file or --url");
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }

    const html = await loadHtml(options);

    const { values, debug } = parsePerformance(html, {
      enableDebugLogging: options.log,
      logger: (message, details) => console.log(message, details),
    });

    if (options.text) {
      const plainText = htmlToPlainText(html);
      await fs.writeFile(path.resolve(options.text), plainText, "utf8");
    }

    if (options.block) {
      await fs.writeFile(
        path.resolve(options.block),
        debug.rawBlock ?? "",
        "utf8",
      );
    }

    const output = { values, debug };

    if (options.out) {
      await fs.writeFile(
        path.resolve(options.out),
        JSON.stringify(output, null, 2),
        "utf8",
      );
    }

    console.log(JSON.stringify(output, null, 2));
    if (debug.reason) {
      process.exitCode = 1;
      console.error(`⚠️ Parse finished with reason: ${debug.reason}`);
    }
  } catch (error) {
    console.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

main();
