import { green, yellow } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import axios from 'axios';

const ETHERSCAN_APYI_SUPPORTED_NETWORKS = [
  'mainnet',
  'goerli',
  'polygon',
  'mumbai',
];

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  ...contractArgs: unknown[]
) {
  if (await isVerified(hre, contractAddress)) {
    console.log(yellow('Contract already verified'));
    return;
  }

  const { network } = hre.hardhatArguments;
  if (!ETHERSCAN_APYI_SUPPORTED_NETWORKS.includes(network)) {
    console.log(
      yellow(
        `Unable to verify contract ${contractAddress}: network ${network} is not supported on the hardhat etherscan verify plugin`,
      ),
    );
    return;
  }

  console.log(yellow(`Verifying contract ${contractAddress} with arguments:`));
  console.log(yellow(JSON.stringify(contractArgs, null, 2)));

  try {
    await hre.run('verify:verify', {
      address: contractAddress,
      constructorArguments: contractArgs,
    });
  } catch (err) {
    console.error('in verify contracts:', err);
    if (err.message.toLowerCase().includes('already verified')) {
      console.log(green(`Contract is already verified`));
      return;
    } else {
      throw err;
    }
  }
  console.log(green(`Contract verified successfully`));
}

async function isVerified(
  hre: HardhatRuntimeEnvironment,
  address: string,
): Promise<boolean> {
  const networkName = hre.network.name;
  let baseUrl = '';

  switch (networkName) {
    case 'mumbai':
      baseUrl = 'https://api-testnet.polygonscan.com/api';
      break;
    case 'polygon':
      baseUrl = 'https://api.polygonscan.com/api';
      break;
    case 'mainnet':
      baseUrl = 'https://api.etherscan.io/api';
      break;
    case 'goerli':
      baseUrl = 'https://api-goerli.etherscan.io/api';
      break;
    default:
      return false;
  }

  const apiKey = hre.config.etherscan.apiKey[networkName];
  if (!apiKey) {
    console.error('No etherscan api key found for network', networkName);
    return false;
  }

  const res = await axios.get(
    `${baseUrl}?module=contract&action=getabi&address=${address}&apiKey=${apiKey}`,
  );

  return res.data.status === '1';
}
