import { green, yellow } from 'chalk';
import { HardhatRuntimeEnvironment, Network } from 'hardhat/types';
import axios from 'axios';

const ETHERSCAN_APY_SUPPORTED_NETWORKS = [
  'mainnet',
  'rinkeby',
  'polygon',
  'mumbai',
];

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  ...contractArgs: unknown[]
) {
  if (await isVerified(contractAddress, hre.network)) {
    console.log(yellow('Contract already verified'));
    return;
  }

  const { network } = hre.hardhatArguments;
  if (!ETHERSCAN_APY_SUPPORTED_NETWORKS.includes(network)) {
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

async function isVerified(address: string, network: Network): Promise<boolean> {
  const supportedNetworks = ['mumbai'];

  if (!supportedNetworks.includes(network.name)) {
    return false;
  }

  const baseUrl = 'https://api-testnet.polygonscan.com/api';

  const res = await axios.get(
    `${baseUrl}?module=contract&action=getabi&address=${address}&apiKey=${process.env.ETHERSCAN_KEY}`,
  );

  return res.data.status === '1';
}
