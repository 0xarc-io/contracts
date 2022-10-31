import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { TestToken, TestTokenFactory } from '@src/typings';
import { ArcxRedemption } from '@src/typings/ArcxRedemption';
import { MockArcxRedemptionFactory } from '@src/typings/MockArcxRedemptionFactory';
import { addSnapshotBeforeRestoreAfterEach } from '@test/helpers/testingUtils';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import { ethers } from 'hardhat';

const ARCX_AMOUNT = (BigNumber.from(10).pow(18)).mul(100);
const USDC_AMOUNT = (BigNumber.from(10).pow(6)).mul(100);

describe('ArcxRedemption', () => {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  let redemption: ArcxRedemption;

  let exchangeRate: BigNumber;
  let cutoffDate: BigNumber;

  let usdcToken: TestToken;
  let arcxToken: TestToken;

  before(async () => {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user = signers[1];

    cutoffDate = BigNumber.from(10);
    exchangeRate = utils.parseEther('0.5');

    usdcToken = await new TestTokenFactory(owner).deploy("TES", "TEST", 6);
    arcxToken = await new TestTokenFactory(owner).deploy("TEST", "TEST", 18);

    redemption = await new MockArcxRedemptionFactory(owner).deploy(
        usdcToken.address,
        arcxToken.address,
        exchangeRate,
        cutoffDate
    );

    await redemption.setCurrentTimestamp(cutoffDate);

    await arcxToken.mintShare(user.address, ARCX_AMOUNT);
    await usdcToken.mintShare(redemption.address, USDC_AMOUNT);

    redemption = new MockArcxRedemptionFactory(user).attach(redemption.address);
    
    await new TestTokenFactory(user).attach(arcxToken.address).approve(redemption.address, ARCX_AMOUNT);

  });

  addSnapshotBeforeRestoreAfterEach();

  describe("#deployment", function () {

    it("should deploy with the correct paramaters", async () => {
        expect(await redemption.usdcToken()).to.equal(usdcToken.address);
        expect(await redemption.arcxToken()).to.equal(arcxToken.address);
        expect(await redemption.exchangeRate()).to.equal(exchangeRate);
        expect(await redemption.cutoffDate()).to.equal(cutoffDate);
    });

  });

  describe("#redeem", function () {

    it("should not be able to redeem without enough ARCx", async () => {
      await expect(redemption.redeem(ARCX_AMOUNT.add(1))).to.reverted;
    });

    it("should not be able to redeem past the redemption date", async () => {
        await redemption.setCurrentTimestamp(cutoffDate.add(1)); 
        await expect(redemption.redeem(ARCX_AMOUNT)).to.reverted;
    });

    it("should be able to redeem successfully", async () => {
        await redemption.redeem(ARCX_AMOUNT)

        const contractUsdcBalance = await usdcToken.balanceOf(redemption.address);
        const contractArcxBalance = await arcxToken.balanceOf(redemption.address);

        expect(contractUsdcBalance).to.eq(USDC_AMOUNT.div(2));
        expect(contractArcxBalance).to.eq(ARCX_AMOUNT);
    });

  });

  describe("#withdraw", function () {

    it("should not be able to withdraw as a non-owner", async () => {
      await expect(redemption.withdraw(usdcToken.address, ARCX_AMOUNT, user.address)).to.be.reverted;
    });

    it("should be able to withdraw as the owner", async () => {
        const ownerRedemption =  new MockArcxRedemptionFactory(owner).attach(redemption.address);

        expect(await usdcToken.balanceOf(user.address)).to.eq(BigNumber.from(0));
        expect(await arcxToken.balanceOf(user.address)).to.eq(ARCX_AMOUNT);

        await redemption.redeem(ARCX_AMOUNT)

        expect(await usdcToken.balanceOf(redemption.address)).to.eq(USDC_AMOUNT.div(2));
        expect(await arcxToken.balanceOf(redemption.address)).to.eq(ARCX_AMOUNT);
        
        await ownerRedemption.withdraw(usdcToken.address, USDC_AMOUNT.div(2), user.address);
        await ownerRedemption.withdraw(arcxToken.address, ARCX_AMOUNT, user.address);

        expect(await usdcToken.balanceOf(user.address)).to.eq(USDC_AMOUNT);
        expect(await arcxToken.balanceOf(user.address)).to.eq(ARCX_AMOUNT);
    });

  });

});