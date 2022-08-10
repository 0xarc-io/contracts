import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { NetworkParams } from '../../deployments/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';

export async function loadHardhatDetails(hre: HardhatRuntimeEnvironment) {
  const network = hre.network.name;
  const signer: SignerWithAddress = (await hre.ethers.getSigners())[0];

  const networkDetails = hre.config.networks[network];
  const networkConfig = {
    network,
    signer,
    gasPrice: networkDetails.gasPrice,
  } as NetworkParams;

  return {
    network,
    signer,
    networkConfig,
    networkDetails,
  };
}
