import 'module-alias/register';

/**
 * This is the most crucial function of the system as it's how users actually borrow from a vault.
 * When borrowing, we won't let a user borrow without a credit proof if they're already being tracked
 * in the system. This means that if people can't obtain a credit proof then they can't borrow. The same
 * cannot be said for liquidate and repay since the credit proof is optional. When testing the borrow
 * function we need to make sure that every case of with a credit proof, without a credit proof, price changes
 * is tested.
 */

describe('SapphireCore.borrow()', () => {
  it('borrows above the c-ratio', async () => {});

  it('updates the index', async () => {});

  it('borrows more if more collateral is provided', async () => {});

  it('borrows more if a valid score proof is provided (first time)', async () => {
    // The user has an existing position, then they obtain a credit score and can borrow more
  });

  it('borrows more if the credit score increases', async () => {
    // The user's existing credit score is updated and increases letting them borrow more
  });

  it('borrows less if the credit score decreases', async () => {
    // The user's existing credit score is updated and decreases letting them borrow less
  });

  it(`borrows from someone else's vault if called by the global operator`);

  it(`borrows from someone else's vault if called by an approved position operator`);

  it(`should not borrow from someone else's vault if called by a position operator, but on an unapproved vault`, async () => {
    // 1. User A opens vault X
    // 2. Position operator P is approved on vault Y
    // 3. P tries to borrow on X -> expect revert
  });

  it('should not borrow with a score proof if no assesor is set', async () => {
    // You can't borrow with a credit score if no assesor is set in the Core
  });

  it('should not borrow without a credit proof if a score exists on-chain', async () => {
    // You cannot borrow without a credit proof if one exists on-chain
  });

  it('should not borrow more if the c-ratio is at the minimum', async () => {});

  it("should not borrow from someone else's account", async () => {});

  it('should not borrow without enough collateral', async () => {});

  it('should not borrow more if the price decreases', async () => {});

  it('should not borrow more if more interest has accrued', async () => {});

  it('should not borrow more than the collateral limit', async () => {});

  it('should not borrow more than the maximum amount', async () => {
    // 1. Borrow half of allowed amount
    // 2. Borrow another half + 1 -> expect revert
  });

  it('should not borrow from an inexistent vault');

  it('should not borrow more than the liquidity of the borrow asset');
});
