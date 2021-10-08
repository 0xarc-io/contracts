import { green, yellow } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  ...contractArgs: any[]
) {
  console.log(yellow(`Verifying contract...`));

  await hre.run('verify:verify', {
    address: contractAddress,
    constructorArguments: contractArgs,
  });
  console.log(green(`Contract verified successfully`));
}
