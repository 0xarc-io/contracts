'use strict';

const {
  constants: { CONFIG_FILENAME, DEPLOYMENT_FILENAME },
} = require('../../..');

const {
  ensureNetwork,
  ensureDeploymentPath,
  getDeploymentPathForNetwork,
  loadAndCheckRequiredSources,
} = require('../util');

const versionsHistory = async ({ network, deploymentPath }) => {
  ensureNetwork(network);
  deploymentPath = deploymentPath || getDeploymentPathForNetwork(network);
  ensureDeploymentPath(deploymentPath);

  // replace console.log so all output is simply the CSV contents
  const oldLogger = console.log.bind(console);
  console.log = () => {};

  const { versions } = loadAndCheckRequiredSources({
    deploymentPath,
    network,
  });

  const entries = [];
  const versionValues: any = Object.values(versions);
  for (const { tag, date, commit, contracts } of versionValues) {
    const base = { tag, date, commit };
    for (const [contract, obj] of Object.entries(contracts)) {
      const { address, status, replaced_in: replacedIn } = obj as any;
      entries.push(
        Object.assign(
          {
            contract,
            address,
            status,
            replacedIn,
          },
          base,
        ),
      );
    }
  }
  const fields = ['tag', 'date', 'commit', 'contract', 'address', 'status', 'replacedIn'];

  let content = fields.join(','); // headers
  content +=
    '\n' + entries.map((entry) => fields.map((field) => entry[field]).join(',')).join('\n');
  console.log = oldLogger;
  console.log(content);
};

module.exports = {
  versionsHistory,
  cmd: (program) =>
    program
      .command('versions-history')
      .description('Output version history of a network in a CSV format')
      .option('-n, --network <value>', 'The network to run off.', (x) => x.toLowerCase(), 'kovan')
      .option(
        '-d, --deployment-path <value>',
        `Path to a folder that has your input configuration file ${CONFIG_FILENAME} and where your ${DEPLOYMENT_FILENAME} files will go`,
      )
      .action(versionsHistory),
};
