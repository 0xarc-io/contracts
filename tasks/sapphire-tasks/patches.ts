import { task } from 'hardhat/config';
import { assert } from 'console';
import { deployContract, loadDetails } from '@deployments/src';
import { ArcProxyFactory, SapphirePoolFactory } from '@src/typings';
import { DeploymentType } from '@deployments/types';
import { roundUpDiv } from '@test/helpers/roundUpOperations';
import { BASE } from '@src/constants';

task('repair-withdraw-bug').setAction(async (_taskArgs, hre) => {
  const { signer, networkConfig } = await loadDetails(hre);

  assert(signer.address === '0x9c767178528c8a205DF63305ebdA4BB6B147889b');

  // Deploy new contract
  const upgradeAddress = await deployContract(
    {
      name: 'SapphirePool',
      source: 'SapphirePool',
      data: new SapphirePoolFactory(signer).getDeployTransaction(),
      version: 2,
      type: DeploymentType.borrowing,
    },
    networkConfig,
  );

  // Upgrade contract
  const poolProxyAddress = '0x59b8a21A0B0cE87E308082Af6fFC4205b5dC932C';
  const poolProxy = await ArcProxyFactory.connect(poolProxyAddress, signer);
  const upgradeTx = await poolProxy.upgradeTo(upgradeAddress);
  await upgradeTx.wait();

  // Deployer withdraws exactly the deposit utilization to set utilization to 0
  const pool = await SapphirePoolFactory.connect(poolProxyAddress, signer);
  const usdcAddress = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174';
  const { amountUsed: assetUtilization } = await pool.assetDepositUtilization(
    usdcAddress,
  );
  const supply = await pool.totalSupply();
  const poolValue = await pool.getPoolValue();
  const usdcScalar = 10 ** 12;
  const depositUtilizationLpEquivalent = roundUpDiv(
    assetUtilization.mul(usdcScalar).mul(supply).div(BASE),
    poolValue,
  );
  await pool.withdraw(depositUtilizationLpEquivalent, usdcAddress);

  // Set Deployer's utilization to 0
  await pool.resetBorrowUtilization(signer.address);

  // The utilization should be 0, and user's deposit should be 0
  assert((await pool.assetDepositUtilization(usdcAddress)).amountUsed.eq(0));
  assert((await pool.deposits(signer.address)).eq(0));
});
