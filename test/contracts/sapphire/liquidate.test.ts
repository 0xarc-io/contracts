import 'module-alias/register';

/**
 * When a liquidation occurs, what's really happening is that the debt which a user owes the
 * the system needs to be repaid by someone else. The incentive for this other user to repay
 * another user's debt is because they acquire the user's collateral at a discount and can make
 * an insta profit by selling the collateral they got a discount.
 */
describe('SapphireCore.liquidate()', () => {
  it('should be able to liquidate an undercollateralized position', async () => {
    // When a liquidation is done we need to check the following
    // - Ensure that the liquidator has enough debt (STABLEx)
    // - Ensure the position is under-collateralized
    // When a liquidation happens we need to check
    // - The debt has been taken from the liquidator (STABLEx)
    // - The collateral has been given to the liquidator
    // - The total STABLEx supply has decreased
    // - The position collateral amount has decreased
    // - The position debt amount has decreased
    // - A portion of collateral is sent to the fee collector
  });

  it('should be able to provide a score proof and then liquidate the position', async () => {
    // Setup a test which has a valid position
    // The user's credit score decreases
    // The liquidator submits the user's credit score and is then able to liquidate
  });

  it('should be able to liquidate if interest accumulates (1 day)', async () => {
    // Open a position at the boundary
    // Test that a liquidation will occur if the user accumulates enough debt via interest
  });

  it('should be able to liquidate if interest accumulates (1 year)', async () => {
    // Open a position at the boundary
    // Test that a liquidation will occur if the user accumulates enough debt via interest
  });

  it('should be able to liquidate if the price drops', async () => {
    // Update the price to below the position's collateral ratio
    // Check if the position was liquidated correctly
  });

  it('should be able to liquidate again if the price drops', async () => {
    // If the price drops twice, the position should be able to be liquidated twice
  });

  it('should be able to liquidate the remains if the price crashes by a large amount', async () => {
    // If the price drops more than the value of the collateral
    // A liquidator can take whatever remaining value is in the position
  });

  it('should not be able to liquidate a collateralized position ', async () => {});

  // @TODO:Some case for when the user is under-collateralised, but their credit score increases
  // making them immune to the liquidation and causing it to throw. Not sure what to call this.

  it('should not be able to liquidate without enough debt', async () => {});

  it('should not be able to liquidate if the price increases', async () => {});
});
