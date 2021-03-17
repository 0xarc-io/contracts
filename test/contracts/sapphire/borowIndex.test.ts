import { expect } from 'chai';

describe('borrowIndex', () => {
  describe('calculate the interest rate for opening a position', () => {
    it('for one year', () => {});

    it('for one and half years', () => {});

    it('for two years', () => {});
  });

  describe('calculate the interest rate for opening two position', () => {
    it('the first for one year, the second for half a year', () => {});

    it('the first for one and half years, the second for 3 months', () => {});

    it('the first for two years, the second for one and half years', () => {});
  });

  describe('calculate the interest rate for 2 years for opening and updating a position', () => {
    it('open for 1 year and borrow more for half a year', () => {});

    it('open for 1 year and liquidate after a year', () => {});

    it('open for 1 year and repay partially after a year', () => {});

    it('open for 1 year and repay fully after a year', () => {});
  });
});
