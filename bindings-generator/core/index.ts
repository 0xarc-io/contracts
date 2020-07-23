import { Contract } from '../parse/complex-solidity-types';
import { writeIndex, writeTSFile } from './write';
import * as fs from 'fs';
import * as path from 'path';
import { JSONCache, ArtifactCache } from './cache';
import glob from 'glob';
import { TSFile, Options } from './types';
import { parseABI } from '../parse/parser';
import { generateEthers } from './convert';

export function generate(
  opts: Options,
  generator: (contract: Contract) => TSFile = generateEthers,
  cache: ArtifactCache = new JSONCache(opts.outDir),
) {
  if (fs.existsSync(opts.pattern) && fs.lstatSync(opts.pattern).isDirectory()) {
    // If the pattern is a directory, transform all json files in that directory
    opts.pattern = path.resolve(opts.pattern, '**/*.json');
  }

  const fileNames = glob.sync(opts.pattern);
  const contractNames: Array<string> = [];

  fileNames.forEach((name: string) => {
    const buffer = fs.readFileSync(name);
    const file = JSON.parse(buffer.toString());
    if (isDeployable(file)) {
      const contractName = file.contractName;
      contractNames.push(contractName);
      const artifact = { name: contractName, abi: file.abi, bytecode: file.bytecode };
      if (cache.hasChanged(artifact)) {
        const contract = parseABI(artifact);
        const binding = generator(contract);
        writeTSFile(opts.outDir, binding);
        cache.update(artifact);
      }
    }
  });

  writeIndex(opts.outDir, contractNames);
}

function isDeployable(file: any): boolean {
  // empty contract abi = []
  // abstract contract bytecode = '0x'
  return file.abi && file.abi.length > 0 && file.bytecode;
}
