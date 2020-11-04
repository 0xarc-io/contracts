import 'module-alias/register';

import simpleDescribe from '@test/helpers/simpleDescribe';
import { ITestContext } from '@test/helpers/simpleDescribe';
import { BigNumber } from 'ethers/utils';
import ArcDecimal from '@src/utils/ArcDecimal';
import ArcNumber from '@src/utils/ArcNumber';
import { expectRevert } from '@src/utils/expectRevert';
import { AddressAccrual } from '@src/typings/AddressAccrual';
import { TestToken } from '@src/typings/TestToken';
import { getWaffleExpect, Account } from '../../helpers/testingUtils';

let ownerAccount: Account;
let investorAccount: Account;
let kermanHoldersAccount: Account;
let arcAccount: Account;

const expect = getWaffleExpect();

let distribution: AddressAccrual;
let rewardToken: TestToken;

const BASE = new BigNumber(10).pow(18);

const INVESTOR_SHARE = ArcDecimal.new(15.15).value;
const KERMAN_SHARE = ArcDecimal.new(3.03).value;
const ARC_SHARE = ArcDecimal.new(81.82).value;

async function init(ctx: ITestContext): Promise<void> {
  ownerAccount = ctx.accounts[0];
  investorAccount = ctx.accounts[1];
  kermanHoldersAccount = ctx.accounts[2];
  arcAccount = ctx.accounts[3];
}

simpleDescribe('Distribution', init, (ctx: ITestContext) => {
  beforeEach(async () => {
    rewardToken = await TestToken.deploy(ownerAccount.signer, 'ARC', 'ARC');
    distribution = await AddressAccrual.deploy(ownerAccount.signer, rewardToken.address);

    await rewardToken.mintShare(distribution.address, ArcNumber.new(100));

    await distribution.increaseShare(investorAccount.address, INVESTOR_SHARE);
    await distribution.increaseShare(kermanHoldersAccount.address, KERMAN_SHARE);
    await distribution.increaseShare(arcAccount.address, ARC_SHARE);
  });

  async function claimAs(caller: Account) {
    const contract = await AddressAccrual.at(caller.signer, distribution.address);
    return await contract.claimFees();
  }

  it('should be able to increase shares', async () => {
    expect(await distribution.balanceOf(investorAccount.address)).to.equal(INVESTOR_SHARE);
    expect(await distribution.balanceOf(kermanHoldersAccount.address)).to.equal(KERMAN_SHARE);
    expect(await distribution.balanceOf(arcAccount.address)).to.equal(ARC_SHARE);
    expect(await distribution.totalSupply()).to.equal(ArcNumber.new(100));
  });

  it('should be able to decrease shares', async () => {
    await distribution.decreaseShare(investorAccount.address, ArcNumber.new(1));

    expect(await distribution.balanceOf(investorAccount.address)).to.equal(
      INVESTOR_SHARE.sub(ArcNumber.new(1)),
    );

    await distribution.increaseShare(investorAccount.address, ArcNumber.new(1));
    expect(await distribution.balanceOf(investorAccount.address)).to.equal(INVESTOR_SHARE);
  });

  it('should be able to claim', async () => {
    await claimAs(investorAccount);
    await claimAs(kermanHoldersAccount);
    await claimAs(arcAccount);

    expect(await distribution.supplyIndex(investorAccount.address)).to.equal(BASE);
    expect(await distribution.supplyIndex(kermanHoldersAccount.address)).to.equal(BASE);
    expect(await distribution.supplyIndex(arcAccount.address)).to.equal(BASE);

    expect(await rewardToken.balanceOf(investorAccount.address)).to.equal(INVESTOR_SHARE);
    expect(await rewardToken.balanceOf(kermanHoldersAccount.address)).to.equal(KERMAN_SHARE);
    expect(await rewardToken.balanceOf(arcAccount.address)).to.equal(ARC_SHARE);
  });

  it('should not be able to claim more than possible', async () => {
    await claimAs(investorAccount);

    await expectRevert(claimAs(investorAccount));

    await rewardToken.mintShare(distribution.address, ArcNumber.new(10));
    await claimAs(investorAccount);

    expect((await rewardToken.balanceOf(investorAccount.address)).toString()).to.equal(
      INVESTOR_SHARE.add(INVESTOR_SHARE.div(10)).toString(),
    );

    await expectRevert(claimAs(investorAccount));
  });
});
