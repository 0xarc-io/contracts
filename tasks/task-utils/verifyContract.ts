import { green, yellow } from 'chalk';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

export async function verifyContract(
  hre: HardhatRuntimeEnvironment,
  contractAddress: string,
  ...contractArgs: any[]
) {
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
