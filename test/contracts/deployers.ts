import { Signer } from 'ethers';

import { ArcProxy__factory } from '@src/typings';
import { MockSapphirePassportScores__factory } from '@src/typings';
import { DefiPassport__factory } from '@src/typings';

export async function deployMockSapphirePassportScores(deployer: Signer) {
  const creditScoreImp = await new MockSapphirePassportScores__factory(
    deployer,
  ).deploy();

  const proxy = await new ArcProxy__factory(deployer).deploy(
    creditScoreImp.address,
    await deployer.getAddress(),
    [],
  );
  return MockSapphirePassportScores__factory.connect(proxy.address, deployer);
}

export async function deployDefiPassport(deployer: Signer) {
  const defiPassportImpl = await new DefiPassport__factory(deployer).deploy();

  const proxy = await new ArcProxy__factory(deployer).deploy(
    defiPassportImpl.address,
    await deployer.getAddress(),
    [],
  );

  return DefiPassport__factory.connect(proxy.address, deployer);
}
