import hre from 'hardhat';

export function forkNetwork(rpc: string, blockNumber: number) {
  return hre.network.provider.request({
    method: 'hardhat_reset',
    params: [
      {
        forking: {
          jsonRpcUrl: rpc,
          blockNumber: blockNumber,
        },
      },
    ],
  });
}
