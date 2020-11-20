import 'hardhat/types/config';
import 'hardhat/types/runtime';

declare module 'hardhat/types/config' {
  type UserTypeConfig = {
    owner?: string;
  };

  interface HttpNetworkUserConfig {
    users?: UserTypeConfig;
  }
}
