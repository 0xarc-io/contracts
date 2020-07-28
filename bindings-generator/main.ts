#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
// import yargs from "yargs";
import { generate } from './core';

// const { _: patterns, ...rest } = yargs
//   .usage('Usage: $0 <command> [options]')
//   .command('', 'Generate bindings for the given pattern')
//   .example('$0 contracts/*.sol -o build', 'Generate bindings for the given pattern')
//   .option('out', {
//       alias: 'o',
//       type: 'string',
//       nargs: 1,
//       describe: 'Output directory for generated files',
//       default: 'bindings'
//   })
//   .help('h')
//   .alias('h', 'help').argv

function main() {
  // let pattern = patterns[0];
  generate({ pattern: 'artifacts/**/*.json', outDir: './src/typings' });
}

main();
