import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BASE } from '@src/constants';
import {
  MockStakingAccrualERC20,
  MockStakingAccrualERC20V5,
} from '@src/typings';
import { expect } from 'chai';

async function checkStakedBalance(
  starcx: MockStakingAccrualERC20 | MockStakingAccrualERC20V5,
  user: SignerWithAddress,
) {
  const stArcxBalance = await starcx.balanceOf(user.address);
  const arcAmount = await starcx.toStakingToken(stArcxBalance);
  expect(arcAmount).eq(
    stArcxBalance.mul(await starcx.getExchangeRate()).div(BASE),
  );
  expect(await starcx.toStakedToken(arcAmount)).eq(stArcxBalance);
}

export default checkStakedBalance;
