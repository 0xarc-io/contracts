import { expect } from 'chai';

describe('borrowIndex', () => {
  describe('calculate the index for opening a position', () => {
    it('for one year', () => {});

    it('for one and half years', () => {});

    it('for two years', () => {});
  });

  describe('calculate the index for opening two positions', () => {
    it('the first for one year, the second for half a year', () => {});

    it('the first for one and a half years, the second for 3 months', () => {});

    it('the first for two years, the second for one and half years', () => {});
  });

  describe('calculate the index for 2 years for opening and updating a position', () => {
    it('open for 1 year and borrow more after this year', () => {});

    it('open for 1 year and liquidate after this year', () => {});

    it('open for 1 year and repay partially after this year', () => {});

    it('open for 1 year and repay fully after this year', () => {});
  });
});
