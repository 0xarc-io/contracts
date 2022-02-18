import {
  SapphireMapperLinear,
  SapphireMapperLinearFactory,
} from '@src/typings';
import { expectRevert } from '@test/helpers/expectRevert';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';

describe('SapphireMapperLinear', () => {
  let mapper: SapphireMapperLinear;

  before(async () => {
    const signers = await ethers.getSigners();
    const admin = signers[0];
    mapper = await new SapphireMapperLinearFactory(admin).deploy();
  });

  it('reverts if scoreMax or upperbound are 0', async () => {
    await expectRevert(mapper.map(0, 0, 1, 10));
    await expectRevert(mapper.map(0, 5, 0, 0));
    await expectRevert(mapper.map(0, 0, 0, 0));
  });

  it('reverts if the lower bound and the upper bound are equal', async () => {
    await expectRevert(mapper.map(0, 0, 5, 5));
  });

  it('reverts if the upper bound is smaller than the lower bound', async () => {
    await expectRevert(mapper.map(0, 0, 5, 4));
  });

  it('reverts if score is bigger than the maximum score', async () => {
    await expectRevert(mapper.map(6, 5, 1, 10));
  });

  it('returns the lower bound if score is max', async () => {
    expect(await mapper.map(10, 10, 1, 10)).to.eq(1);
  });

  it('returns the upper bound if score is min', async () => {
    expect(await mapper.map(0, 10, 1, 10)).to.eq(10);
  });

  it('returns a correct score mapping', async () => {
    expect(await mapper.map(0, 1, 0, 1)).to.eq(BigNumber.from(1));

    expect(await mapper.map(5, 10, 0, 100)).to.eq(BigNumber.from(50));

    expect(await mapper.map(10, 10, 0, 100)).to.eq(BigNumber.from(0));

    expect(
      await mapper.map(
        utils.parseEther('65'),
        utils.parseEther('100'),
        0,
        utils.parseEther('1000'),
      ),
    ).to.eq(utils.parseEther('350'));
  });
});
