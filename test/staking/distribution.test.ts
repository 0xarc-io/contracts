import { TestToken } from '@src/typings';
import simpleDescribe from '../helpers/simpleDescribe';
import { ITestContext } from '../helpers/simpleDescribe';
import { Wallet } from 'ethers';
import { BigNumber } from 'ethers/utils';
import { Distribution } from '@src/typings/Distribution';
import ArcDecimal from '../../src/utils/ArcDecimal';
import ArcNumber from '../../dist/src/utils/ArcNumber';
import { expectRevert } from '../../src/utils/expectRevert';

let ownerWallet: Wallet;
let investorWallet: Wallet;
let kermanHoldersWallet: Wallet;
let arcWallet: Wallet;

jest.setTimeout(30000);

let distribution: Distribution;
let rewardToken: TestToken;

const BASE = new BigNumber(10).pow(18);

const INVESTOR_SHARE = ArcDecimal.new(15.15).value;
const KERMAN_SHARE = ArcDecimal.new(3.03).value;
const ARC_SHARE = ArcDecimal.new(81.82).value;

async function init(ctx: ITestContext): Promise<void> {
  ownerWallet = ctx.wallets[0];
  investorWallet = ctx.wallets[1];
  kermanHoldersWallet = ctx.wallets[2];
  arcWallet = ctx.wallets[3];
}

simpleDescribe('Distribution', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    rewardToken = await TestToken.deploy(ownerWallet, 'ARC', 'ARC');
    distribution = await Distribution.deploy(ownerWallet, rewardToken.address);

    await rewardToken.mintShare(distribution.address, ArcNumber.new(100));

    await distribution.increaseShare(investorWallet.address, INVESTOR_SHARE);
    await distribution.increaseShare(kermanHoldersWallet.address, KERMAN_SHARE);
    await distribution.increaseShare(arcWallet.address, ARC_SHARE);
  });

  async function claimAs(caller: Wallet) {
    const contract = await Distribution.at(caller, distribution.address);
    return await contract.claimFees();
  }

  it('should be able to increase shares', async () => {
    expect(await distribution.balanceOf(investorWallet.address)).toEqual(INVESTOR_SHARE);
    expect(await distribution.balanceOf(kermanHoldersWallet.address)).toEqual(KERMAN_SHARE);
    expect(await distribution.balanceOf(arcWallet.address)).toEqual(ARC_SHARE);
    expect(await distribution.totalSupply()).toEqual(ArcNumber.new(100));
  });

  it('should be able to decrease shares', async () => {
    await distribution.decreaseShare(investorWallet.address, ArcNumber.new(1));

    expect(await distribution.balanceOf(investorWallet.address)).toEqual(
      INVESTOR_SHARE.sub(ArcNumber.new(1)),
    );

    await distribution.increaseShare(investorWallet.address, ArcNumber.new(1));
    expect(await distribution.balanceOf(investorWallet.address)).toEqual(INVESTOR_SHARE);
  });

  it('should be able to claim', async () => {
    await claimAs(investorWallet);
    await claimAs(kermanHoldersWallet);
    await claimAs(arcWallet);

    expect(await distribution.supplyIndex(investorWallet.address)).toEqual(BASE);
    expect(await distribution.supplyIndex(kermanHoldersWallet.address)).toEqual(BASE);
    expect(await distribution.supplyIndex(arcWallet.address)).toEqual(BASE);

    expect(await rewardToken.balanceOf(investorWallet.address)).toEqual(INVESTOR_SHARE);
    expect(await rewardToken.balanceOf(kermanHoldersWallet.address)).toEqual(KERMAN_SHARE);
    expect(await rewardToken.balanceOf(arcWallet.address)).toEqual(ARC_SHARE);
  });

  it('should not be able to claim more than possible', async () => {
    await claimAs(investorWallet);

    await expectRevert(claimAs(investorWallet));

    await rewardToken.mintShare(distribution.address, ArcNumber.new(10));
    await claimAs(investorWallet);

    expect((await rewardToken.balanceOf(investorWallet.address)).toString()).toEqual(
      INVESTOR_SHARE.add(INVESTOR_SHARE.div(10)).toString(),
    );

    await expectRevert(claimAs(investorWallet));
  });
});
