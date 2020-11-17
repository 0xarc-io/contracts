import { expect } from 'chai';

import { BASE, ONE_YEAR_IN_SECONDS } from '@src/constants';

import ArcNumber from '@src/utils/ArcNumber';
import ArcDecimal from '@src/utils/ArcDecimal';

export default function unitTestMozartBorrow(): void {
  const COLLATERAL_AMOUNT = ArcNumber.new(200);
  const BORROW_AMOUNT = ArcNumber.new(50);

  describe.only('borrow()', function () {
    beforeEach(async function () {
      // Open a position at 400% c-ratio
      await this.sdks.mozart.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, this.signers.minter);
    });

    it('should be able to borrow above the c-ratio', async function () {
      const prePosition = await this.sdks.mozart.getPosition(0);
      expect(prePosition.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
      expect(prePosition.borrowedAmount.value).to.equal(BORROW_AMOUNT);

      // Set it right at the boundary of the c-ratio
      await this.sdks.mozart.borrow(0, 0, BORROW_AMOUNT, this.signers.minter);

      const postPosition = await this.sdks.mozart.getPosition(0);
      expect(postPosition.borrowedAmount.value).to.equal(BORROW_AMOUNT.mul(2));
      expect(await this.sdks.mozart.synth().core.isCollateralized(postPosition)).to.be.true;
    });

    it('should update the index', async function () {
      // Set the time to one year from now in order for interest to accumulate
      await this.sdks.mozart.updateTime(ONE_YEAR_IN_SECONDS);
      await this.sdks.mozart.synth().core.updateIndex();

      let borrowIndex = await this.sdks.mozart.synth().core.getBorrowIndex();

      // In order to calculate the new index we need to multiply one year
      // by the interest rate (in seconds)
      let calculatedIndex = BASE.add(
        (await this.sdks.mozart.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
      );

      // Our calculated index should equal the newly set borrow index
      expect(borrowIndex[0]).to.equal(calculatedIndex);

      // Set the time to two years from now in order for interest to accumulate
      await this.sdks.mozart.updateTime(ONE_YEAR_IN_SECONDS.mul(2));
      await this.sdks.mozart.synth().core.updateIndex();

      borrowIndex = await this.sdks.mozart.synth().core.getBorrowIndex();

      calculatedIndex = calculatedIndex.add(
        (await this.sdks.mozart.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
      );

      // Our calculated index should equal the newly set borrow index
      expect(borrowIndex[0]).to.equal(calculatedIndex);
    });

    it('should be able to borrow more if the c-ratio is not at the minimum', async function () {
      const beforePosition = await this.sdks.mozart.getPosition(0);
      await this.sdks.mozart.borrow(0, 0, BORROW_AMOUNT, this.signers.minter);

      const afterPosition = await this.sdks.mozart.getPosition(0);

      expect(afterPosition.collateralAmount.value).to.equal(beforePosition.collateralAmount.value);
      expect(afterPosition.borrowedAmount.value).to.equal(
        beforePosition.borrowedAmount.value.add(BORROW_AMOUNT),
      );
      await expect(this.sdks.mozart.borrow(0, 0, 1, this.signers.minter)).to.be.reverted;
    });

    it('should be able to borrow from someone elses account', async function () {
      await expect(this.sdks.mozart.borrow(0, 0, BORROW_AMOUNT, this.signers.unauthorised)).to.be
        .reverted;
    });

    it('should not be able to borrow without enough collateral', async function () {
      await expect(this.sdks.mozart.borrow(0, 0, BORROW_AMOUNT.add(1), this.signers.minter)).be
        .reverted;
      await expect(
        this.sdks.mozart.borrow(
          0,
          COLLATERAL_AMOUNT.sub(1),
          BORROW_AMOUNT.mul(3),
          this.signers.minter,
        ),
      ).be.reverted;
    });

    it('should be able to borrow more if more collateral provided', async function () {
      await this.sdks.mozart.borrow(0, 0, BORROW_AMOUNT, this.signers.minter);
      await this.sdks.mozart.borrow(
        0,
        COLLATERAL_AMOUNT,
        BORROW_AMOUNT.mul(2),
        this.signers.minter,
      );

      let position = await this.sdks.mozart.getPosition(0);
      const price = await this.sdks.mozart.synth().oracle.fetchCurrentPrice();
      const collateralDelta = await this.sdks.mozart
        .core()
        .calculateCollateralDelta(position.collateralAmount, position.borrowedAmount.value, price);

      expect(collateralDelta.value).to.equal(0);

      await expect(this.sdks.mozart.borrow(0, 0, BORROW_AMOUNT, this.signers.minter)).to.be
        .reverted;
    });

    it('should not be able to borrow more if the price decreases', async function () {
      await this.sdks.mozart.updatePrice(ArcDecimal.new(0.5).value);
      await expect(this.sdks.mozart.borrow(0, 0, 1, this.signers.minter)).to.be.reverted;
    });

    it('should not be able to borrow more if the interest payments have increased', async function () {
      await this.sdks.mozart.updatePrice(ArcDecimal.new(0.5).value);

      expect(await this.sdks.mozart.isCollateralized(0)).to.be.true;

      // Set the time to two years from now in order for interest to accumulate
      await this.sdks.mozart.updateTime(ONE_YEAR_IN_SECONDS);
      await this.sdks.mozart.synth().core.updateIndex();

      expect(await this.sdks.mozart.isCollateralized(0)).to.be.false;
    });

    it('should not be able to borrow more the collateral limit', async function () {
      await this.sdks.mozart.core().setLimits(COLLATERAL_AMOUNT, 0);
      await expect(this.sdks.mozart.borrow(0, 1, 0, this.signers.minter)).to.be.reverted;
    });
  });
}
