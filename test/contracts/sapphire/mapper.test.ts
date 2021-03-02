import { SapphireMapperLinear, SapphireMapperLinearFactory } from '@src/typings';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@test/helpers/expectRevert';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

describe('SapphireMapperLinear', () => {
  let mapper: SapphireMapperLinear;

  before(async () => {
    mapper = await new SapphireMapperLinearFactory().deploy();
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
    await expectRevert(mapper.map(5, 6, 1, 10));
  });

  it('returns a correct score mapping', async () => {
    expect(await mapper.map(0, 1, 0, 1)).to.eq(BigNumber.from(0));

    expect(await mapper.map(5, 10, 0, 100)).to.eq(BigNumber.from(50));

    expect(await mapper.map(ArcNumber.new(65), ArcNumber.new(100), 0, ArcNumber.new(1000))).to.eq(
      ArcNumber.new(650),
    );
  });
});
