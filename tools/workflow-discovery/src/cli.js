#!/usr/bin/env node
// -----------------------------------------------------------------------------
// cli.js - command-line entry point.
//
//   node src/cli.js <folder-with-xml-exports> [--out <folder>] [--all]
//
// Reads every *.xml file in the folder (file name = workflow name), then writes
//   <out>/inventory.csv  - open in Excel / Google Sheets, track status per rule
//   <out>/inventory.md   - paste into the migration plan or a PR
// --all also lists built-in Jira rules (hidden by default; they migrate natively).
// -----------------------------------------------------------------------------
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { parseWorkflowXml } from './parse.js';
import { toInventoryRows, toCsv, toMarkdown } from './report.js';

function parseArgs(argv) {
  const options = { input: null, out: 'migration-inventory', includeBuiltIn: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') options.includeBuiltIn = true;
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--help' || arg === '-h') options.help = true;
    else options.input = arg;
  }
  return options;
}

const USAGE = 'Usage: node src/cli.js <folder-with-xml-exports> [--out <folder>] [--all]';

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.input) {
    console.log(USAGE);
    process.exit(options.help ? 0 : 1);
  }

  const inputDir = resolve(options.input);
  if (!statSync(inputDir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Not a folder: ${inputDir}\n${USAGE}`);
    process.exit(1);
  }

  const files = readdirSync(inputDir).filter((f) => extname(f).toLowerCase() === '.xml').sort();
  if (files.length === 0) {
    console.error(`No .xml files found in ${inputDir}`);
    process.exit(1);
  }

  // Parse each file independently so one broken export does not stop the rest.
  const workflows = [];
  for (const file of files) {
    try {
      workflows.push(parseWorkflowXml(readFileSync(join(inputDir, file), 'utf8'), basename(file, extname(file))));
    } catch (error) {
      console.error(`Skipped ${file}: ${error.message}`);
    }
  }

  const rows = toInventoryRows(workflows, { includeBuiltIn: options.includeBuiltIn });
  const outDir = resolve(options.out);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'inventory.csv'), toCsv(rows));
  writeFileSync(join(outDir, 'inventory.md'), toMarkdown(workflows, rows));

  // Console summary so the result is visible without opening the files.
  for (const wf of workflows) {
    const custom = wf.transitions.flatMap((t) => t.rules).filter((r) => r.custom).length;
    console.log(`${wf.workflow}: ${wf.transitions.length} transitions, ${custom} custom rules`);
  }
  console.log(`\nWrote ${rows.length} rows to ${join(outDir, 'inventory.csv')} and inventory.md`);
}

main();
