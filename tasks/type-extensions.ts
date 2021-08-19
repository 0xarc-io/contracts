import 'hardhat/types/config';
import 'hardhat/types/runtime';

declare module 'hardhat/types/config' {
  type UserTypeConfig = {
    eoaOwner?: string;
    multisigOwner?: string;
    arcxDeployer?: string
  };

  interface HttpNetworkUserConfig {
    users?: UserTypeConfig;
  }
}
