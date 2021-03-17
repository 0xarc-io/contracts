import 'module-alias/register';

/**
 * When calling open(), it's calling borrow underneath the hood but just creates a new position
 * so that no custom logic is used for open versus borrow. The two scenarios to test here are for
 * for with a valid score proof and one without a valid score proof. You only need a score proof
 * if your address has a store proof in the CreditScore contract.
 */
describe('SapphireCore.open()', () => {
  describe('without score proof', () => {
    it('open at the exact c-ratio', async () => {});

    it('open above the c-ratio', async () => {});

    it('revert if opened below the c-ratio', async () => {});

    it('open if no assessor is set', async () => {});

    it('revert if a score for address exists on-chain', async () => {});

    it('revert if opened below the minimum position amount', async () => {});
  });

  describe('with score proof', () => {
    it('open at the exact c-ratio', async () => {});

    it('open above the c-ratio', async () => {});

    it('revert if opened below the c-ratio', async () => {});

    it('revert if no assessor is set', async () => {});

    it('open if a score for address exists on-chain', async () => {});

    it('revert if opened below the minimum position amount', async () => {});
  });
});
