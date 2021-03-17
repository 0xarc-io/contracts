import 'module-alias/register';

/**
 * When calling open(), it's calling borrow underneath the hood but just creates a new position
 * so that no custom logic is used for open versus borrow. The two scenarios to test here are for
 * for with a valid score proof and one without a valid score proof. You only need a score proof
 * if your address has a store proof in the CreditScore contract.
 */
describe('SapphireCore.open()', () => {
  describe('without score proof', () => {
    it('should be able to open at the exact c-ratio', async () => {});

    it('should be able to open above the c-ratio', async () => {});

    it('should be able to calculate the correct interest amount', async () => {});

    it('should not be able to open below the c-ratio', async () => {});

    it('should be able to open without a score proof if no assessor is set', async () => {});

    it('should not be able to open without a score proof if one exists on-chain', async () => {});

    it('should not be able to borrow below the minimum position amount', async () => {});
  });

  describe('with score proof', () => {
    it('should be able to open at the exact c-ratio', async () => {});

    it('should be able to open above the c-ratio', async () => {});

    it('should be able to calculate the correct interest amount', async () => {});

    it('should not be able to open with a score proof if no assessor is set', async () => {});

    it('should not be able to open below the c-ratio', async () => {});

    it('should not be able to borrow below the minimum position amount', async () => {});
  });
});
