'use strict';

import fs from 'fs';
import { gray, yellow, green, red } from 'chalk';
import semver from 'semver';

const path = require('path');
const execFile = require('util').promisify(require('child_process').execFile);

const { stringify, loadAndCheckRequiredSources } = require('../util');

const { networks, getPathToNetwork } = require('../../..');

const versionsUpdate = async ({ versionTag, release }) => {
  console.log(gray('Checking deployments for version:', versionTag));

  // prefix a "v" to the tag
  versionTag = /^v/.test(versionTag) ? versionTag : 'v' + versionTag;

  for (const network of networks) {
    const { deployment, deploymentFile, versions, versionsFile } = loadAndCheckRequiredSources({
      network,
      deploymentPath: getPathToNetwork({ network, path }),
    });

    for (const tag of Object.keys(versions)) {
      if (tag === versionTag) {
        throw Error(`Version: ${versionTag} already used in network: ${network}`);
      } else if (semver.lt(versionTag, semver.coerce(tag))) {
        throw Error(
          `Version: ${versionTag} is less than existing version ${tag} in network: ${network}`,
        );
      }
    }

    // Get commit and date of last commit to the deployment file
    const { stdout } = await execFile('git', [
      'log',
      '-n 1',
      '--pretty=format:"%H %aI"',
      '--',
      deploymentFile,
    ]);
    const [commit, date] = stdout.replace(/\n|"/g, '').split(/\s/);

    const entry = {
      tag: versionTag,
      fulltag: versionTag,
      release,
      network,
      date,
      commit,
      contracts: {},
    };

    let deploymentTargetValues: any = Object.values(deployment.targets);

    deploymentTargetValues.forEach((item) => {
      if (item.hasOwnProperty('dependencies')) {
        Object.values(item.dependencies).forEach((element) => {
          let pushElement: any = element;
          pushElement.name = `${item.name}-${element['dependency']}`;
          deploymentTargetValues.push(pushElement);
          // console.log(Object.values(item.dependencies));
        });

        // deploymentTargetValues.push(Object.values(item.dependencies));
      }
    });

    // return;

    for (const { name, address, source } of deploymentTargetValues) {
      // if the address is already in the version file, skip it
      if (new RegExp(`"${address}"`).test(JSON.stringify(versions))) {
        continue;
      } else {
        console.log(
          gray(
            'Found new contract address',
            green(address),
            'for contract',
            green(name),
            'adding it as current',
          ),
        );
        entry.contracts[name] = {
          address,
          status: 'current',
          keccak256: (deployment.sources[source].source || {}).keccak256,
        };

        // look for that same name with status of current and update it
        const versionsValues: any = Object.values(versions);
        for (const { contracts } of versionsValues) {
          if (name in contracts && contracts[name].status === 'current') {
            console.log(
              gray(
                'Found existing contract',
                yellow(name),
                'with address',
                yellow(contracts[name].address),
                'in versions, updated it as replaced',
              ),
            );
            contracts[name].status = 'replaced';
            contracts[name].replaced_in = versionTag;
          }
        }
      }
    }

    // now for each contract in versions, if it's marked "current" and not in deployments, then consider it deleted
    const versionsValues: any = Object.values(versions);
    for (const { contracts } of versionsValues) {
      for (const [name, entry] of Object.entries(contracts)) {
        // do not mark these contracts as deleted for now
        if ((entry as any).status === 'current' && !(name in deployment.targets)) {
          console.log(
            'Could not find',
            red(name),
            'with address',
            red((entry as any).address),
            'in current deployment. Marking as deleted',
          );
          (entry as any).status = 'deleted';
        }
      }
    }

    if (Object.keys(entry.contracts).length > 0) {
      versions[versionTag] = entry;
    }

    // now write the versions file
    fs.writeFileSync(versionsFile, stringify(versions));
  }
};

module.exports = {
  versionsUpdate,
  cmd: (program) =>
    program
      .command('versions-update')
      .description('Update all version.json files for each deployment')
      .option('-v, --version-tag <value>', `The current version being updated`)
      .option('-r, --release <value>', `The name of the release`)
      .action(versionsUpdate),
};
