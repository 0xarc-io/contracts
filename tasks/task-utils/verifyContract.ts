import { green, yellow } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const ETHERSCAN_APY_SUPPORTED_NETWORKS = [
  'ethereum',
  'rinkeby',
  'polygon',
  'mumbai',
];

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  ...contractArgs: any[]
) {
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
    if (err.message.includes('already verified')) {
      console.log(green(`Contract is already verified`));
      return;
    } else {
      throw err;
    }
  }
  console.log(green(`Contract verified successfully`));
}
