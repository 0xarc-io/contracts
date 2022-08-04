import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { NetworkConfig } from 'hardhat/types';

export default function (
  signer: SignerWithAddress,
  networkDetails: NetworkConfig,
) {
  const ultimateOwner =
    networkDetails['users']['multisigOwner'] ||
    networkDetails['users']['eoaOwner'] ||
    signer.address;

  return ultimateOwner.toLowerCase();
}
