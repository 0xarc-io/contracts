import { expect } from 'chai';

import { Operation } from '../../../../@types/core';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { BASE, ONE_YEAR_IN_SECONDS } from '../../../../src/constants';

import ArcNumber from '../../../../src/utils/ArcNumber';

const COLLATERAL_AMOUNT = ArcNumber.new(100);
const BORROW_AMOUNT = ArcNumber.new(50);

export default function unitTestMozartOpen(): void {
  describe('open()', function () {
    it('should be able to to open at the exact c-ratio', async function () {
      const result = await this.sdks.mozart.openPosition(
        ArcNumber.new(100),
        ArcNumber.new(50),
        this.signers.minter,
      );

      // Simple tests ensuring the events are emitting the correct information
      expect(result.operation).to.equal(Operation.Open, 'Invalid operation emitted');
      expect(result.params.amountOne).to.equal(
        COLLATERAL_AMOUNT,
        'Invalid collateral amount emitted',
      );
      expect(result.params.amountTwo).to.equal(BORROW_AMOUNT, 'Invalid borrow amount emitted');
      expect(result.params.id).to.equal(BigNumber.from(0));
      expect(result.updatedPosition.borrowedAmount.value).to.equal(BORROW_AMOUNT);
      expect(result.updatedPosition.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);

      // Check the newly created position has the correct amounts set
      const position = await this.sdks.mozart.synth().core.getPosition(0);
      expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
      expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT);
      expect(position.owner).to.equal(this.signers.minter.address);

      const totals = await this.sdks.mozart.getSynthTotals();
      expect(totals[0]).to.equal(COLLATERAL_AMOUNT);
      expect(totals[1]).to.equal(BORROW_AMOUNT);

      expect(
        await this.sdks.mozart.synth().collateral.balanceOf(this.sdks.mozart.syntheticAddress()),
      ).to.equal(COLLATERAL_AMOUNT);
      expect(await this.sdks.mozart.synthetic().totalSupply()).to.equal(BORROW_AMOUNT);
      expect(await this.sdks.mozart.synthetic().balanceOf(this.signers.minter.address)).to.equal(
        BORROW_AMOUNT,
      );
    });

    it('should be able to open above the c-ratio', async function () {
      await this.sdks.mozart.openPosition(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        this.signers.minter,
      );

      const position = await this.sdks.mozart.getPosition(0);
      expect(position.borrowedAmount.value).to.equal(BORROW_AMOUNT);
      expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
      expect(position.owner).to.equal(this.signers.minter.address);
    });

    it('should not be able to open below the required c-ratio', async function () {
      await expect(
        this.sdks.mozart.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT.add(1), this.signers.minter),
      ).to.be.reverted;

      await expect(
        this.sdks.mozart.openPosition(COLLATERAL_AMOUNT.sub(1), BORROW_AMOUNT, this.signers.minter),
      ).to.be.reverted;
    });

    it('should be able to calculate the principle amount', async function () {
      await this.sdks.mozart.openPosition(COLLATERAL_AMOUNT, BORROW_AMOUNT, this.signers.minter);

      expect((await this.sdks.mozart.getSynthTotals())[1]).to.equal(BORROW_AMOUNT);

      // The printer and the core should have no synths printed before this point
      expect(
        await this.sdks.mozart.synth().synthetic.balanceOf(this.sdks.mozart.coreAddress()),
      ).to.equal(0);

      // Set the time to one year from now in order for interest to accumulate
      await this.sdks.mozart.updateTime(ONE_YEAR_IN_SECONDS);
      await this.sdks.mozart.synth().core.updateIndex();

      const borrowIndex = await this.sdks.mozart.synth().core.getBorrowIndex();

      // In order to calculate the new index we need to multiply one year
      // by the interest rate (in seconds)
      const calculatedIndex = BASE.add(
        (await this.sdks.mozart.synth().core.getInterestRate()).mul(ONE_YEAR_IN_SECONDS),
      );

      // Our calculated index should equal the newly set borrow index
      expect(borrowIndex[0]).to.equal(calculatedIndex);

      // Open a second position which is borrowing the same amount but
      // should have a lower borrow amount since it's depositing at a time
      // where the borrow index is higher
      const result = await this.sdks.mozart.openPosition(
        COLLATERAL_AMOUNT.mul(2),
        BORROW_AMOUNT,
        this.signers.minter,
      );

      const position = await this.sdks.mozart.getPosition(result.params.id);
      const secondPositionBorrowedAmount = ArcNumber.bigDiv(BORROW_AMOUNT, calculatedIndex);

      // Check the borrowed amount is the interest adjusted value
      expect(position.borrowedAmount.value).to.equal(secondPositionBorrowedAmount);
      expect(position.collateralAmount.value).to.equal(COLLATERAL_AMOUNT.mul(2));
      expect(position.owner).to.equal(this.signers.minter.address);

      // Compute how much the interest adjusted borrow amount for the first position is
      const firstPositionAccumulatedAmount = ArcNumber.bigMul(BORROW_AMOUNT, calculatedIndex);

      // Thet total borrow amount should be the first position accumulated with the newly
      // created second position
      const newBorrowTotal = secondPositionBorrowedAmount.add(firstPositionAccumulatedAmount);

      const totals = await this.sdks.mozart.getSynthTotals();
      expect(totals[0]).to.equal(COLLATERAL_AMOUNT.mul(3));
      expect(totals[1]).to.equal(newBorrowTotal);

      const issuedAmount = await this.sdks.mozart
        .synthetic()
        .getMinterIssued(this.sdks.mozart.coreAddress());
      expect(issuedAmount.value).to.equal(BORROW_AMOUNT.mul(2));
      expect(issuedAmount.sign).to.be.true;

      // The interest increase is simply how much the total is less the amount we know we deposited (par values)
      const interestIncrease = newBorrowTotal.sub(BORROW_AMOUNT.add(secondPositionBorrowedAmount));

      expect(
        await this.sdks.mozart.synth().collateral.balanceOf(this.sdks.mozart.syntheticAddress()),
      ).to.equal(COLLATERAL_AMOUNT.mul(3));
      expect(await this.sdks.mozart.synthetic().totalSupply()).to.equal(BORROW_AMOUNT.mul(2));
      expect(await this.sdks.mozart.synthetic().balanceOf(this.signers.minter.address)).to.equal(
        BORROW_AMOUNT.mul(2),
      );
    });

    it('should not be able to borrow below in the minimum position amount', async () => {});
  });
}
