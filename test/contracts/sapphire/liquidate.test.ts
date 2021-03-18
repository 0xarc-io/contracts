import 'module-alias/register';

/**
 * When a liquidation occurs, what's really happening is that the debt which a user owes the
 * the system needs to be repaid by someone else. The incentive for this other user to repay
 * another user's debt is because they acquire the user's collateral at a discount and can make
 * an insta profit by selling the collateral they got a discount.
 */
describe('SapphireCore.liquidate()', () => {
  it('liquidates an undercollateralized position', async () => {
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

  it('provides a score proof and then liquidates the position', async () => {
    // Setup a test which has a valid position
    // The user's credit score decreases
    // The liquidator submits the user's credit score and is then able to liquidate
  });

  it('liquidates if interest accumulates (1 day)', async () => {
    // Open a position at the boundary
    // Test that a liquidation will occur if the user accumulates enough debt via interest
  });

  it('liquidates if interest accumulates (1 year)', async () => {
    // Open a position at the boundary
    // Test that a liquidation will occur if the user accumulates enough debt via interest
  });

  it('liquidates if the price drops', async () => {
    // Update the price to below the position's collateral ratio
    // Check if the position was liquidated correctly
  });

  it('liquidates again if the price drops', async () => {
    // If the price drops twice, the position bes liquidated twice
  });

  it('liquidates the remains if the price crashes by a large amount', async () => {
    // If the price drops more than the value of the collateral
    // A liquidator can take whatever remaining value is in the position
  });

  it('should not liquidate a collateralized position ', async () => {});

  it('should not liquidate if the credit score improved such that vault is immune to liquidations', async () => {
    /**
     * The user is under-collateralised, but their credit score increases
     * making them immune to the liquidation and causing it to throw
     */
  });

  it('should not liquidate without enough debt', async () => {});

  it('should not liquidate if the price increases', async () => {});

  it('should not liquidate twice in a row', async () => {
    /**
     * Given the price does not change, there isn't a lot of time elapsed and the credit score
     * did not drop significantly, someone should not be able to liquidate twice or more in a row
     */
    // 1. Liquidate
    // 2. Liquidate again -> expect revert: position is collateralized
  });
});
