// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IMintableToken} from "../interfaces/IMintableToken.sol";

import {TypesV1} from "./TypesV1.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Storage} from "../lib/Storage.sol";
import {Math} from "../lib/Math.sol";
import {Adminable} from "../lib/Adminable.sol";

import {StateV1} from "./StateV1.sol";
import {StorageV1} from "./StorageV1.sol";

/**
 * @title CoreV3
 * @author Kerman Kohli
 * @notice This contract holds the core logic for manipulating ARC state. Ideally
        both state and logic could be in one or as libraries however the bytecode
        size is too large for this to occur. The core can be replaced via a new
        proxy implementation for upgrade purposes. Important to note that NO user
        funds are held in this contract. All funds are held inside the synthetic
        asset itself. This was done to show transparency around how much collateral
        is always backing a synth via Etherscan.

        The V3 version fixes the liquidation split calculations to ensure the user
        doesn't get back less than he is liquidating with.
 */
contract CoreV3 is StorageV1, Adminable {

    // ============ Libraries ============

    using SafeMath for uint256;
    using Math for uint256;
    using TypesV1 for TypesV1.Par;

    // ============ Types ============

    enum Operation {
        Open,
        Borrow,
        Repay,
        Liquidate
    }

    struct OperationParams {
        uint256 id;
        uint256 amountOne;
        uint256 amountTwo;
    }

    // ============ Events ============

    event ActionOperated(
        uint8 operation,
        OperationParams params,
        TypesV1.Position updatedPosition
    );

    event ExcessTokensWithdrawn(
        address token,
        uint256 amount,
        address destination
    );

    event PauseStatusUpdated(
        bool value
    );

    // ============ Constructor ============

    constructor() public {
        paused = true;
    }

    function init(address _state)
        external
    {
        require(
            address(state) == address(0),
            "CoreV1.init(): cannot recall init"
        );

        state = StateV1(_state);
        paused = false;
    }

    // ============ Public Functions ============

    /**
     * @dev This is the only function that can be called by user's of the system
     *      and uses an enum and struct to parse the args. This structure guarantees
     *      the state machine will always meet certain properties
     *
     * @param operation An enum of the operation to execute
     * @param params Parameters to exceute the operation against
     */
    function operateAction(
        Operation operation,
        OperationParams memory params
    )
        public
    {
        require(
            paused == false,
            "operateAction(): contracts cannot be paused"
        );

        TypesV1.Position memory operatedPosition;

        (
            uint256 collateralLimit,
            uint256 syntheticLimit,
            uint256 collateralMinimum
        ) = state.risk();

        if (operation == Operation.Open) {
            (operatedPosition, params.id) = openPosition(
                params.amountOne,
                params.amountTwo
            );

            require(
                params.amountOne >= collateralMinimum,
                "operateAction(): must exceed minimum collateral amount"
            );

        } else if (operation == Operation.Borrow) {
            operatedPosition = borrow(
                params.id,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Repay) {
            operatedPosition = repay(
                params.id,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Liquidate) {
            operatedPosition = liquidate(
                params.id
            );
        }

        IERC20 synthetic = IERC20(state.syntheticAsset());
        IERC20 collateralAsset = IERC20(state.collateralAsset());

        require(
            synthetic.totalSupply() <= syntheticLimit || syntheticLimit == 0,
            "operateAction(): synthetic supply cannot be greater than limit"
        );

        require(
            collateralAsset.balanceOf(address(synthetic)) <= collateralLimit || collateralLimit == 0,
            "operateAction(): collateral locked cannot be greater than limit"
        );

        // SUGGESTION: Making sure the state doesn't get trapped. Echnida fuzzing could help.
        //             Testing very specific cases which a fuzzer may not be able to hit.
        //             Setup derived contract which allows direct entry point of internal functions.

        // Ensure that the operated action is collateralised again
        require(
            state.isCollateralized(operatedPosition) == true,
            "operateAction(): the operated position is undercollateralised"
        );

        emit ActionOperated(
            uint8(operation),
            params,
            operatedPosition
        );
    }

    /**
     * @dev Withdraw tokens owned by the proxy. This will never include depositor funds
     *      since all the collateral is held by the synthetic token itself. The only funds
     *      that will accrue based on CoreV1 & StateV1 is the liquidation fees.
     *
     * @param token Address of the token to withdraw
     * @param destination Destination to withdraw to
     * @param amount The total amount of tokens withdraw
     */
    function withdrawTokens(
        address token,
        address destination,
        uint256 amount
    )
        external
        onlyAdmin
    {
        SafeERC20.safeTransfer(
            IERC20(token),
            destination,
            amount
        );
    }

    function setPause(bool value)
        external
        onlyAdmin
    {
        paused = value;

        emit PauseStatusUpdated(value);
    }

    // ============ Internal Functions ============

    /**
     * @dev Open a new position.
     *
     * @return The new position and the ID of the opened position
     */
    function openPosition(
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        internal
        returns (TypesV1.Position memory, uint256)
    {
        // CHECKS:
        // 1. No checks required as it's all processed in borrow()

        // EFFECTS:
        // 1. Create a new Position struct with the basic fields filled out and save it to storage
        // 2. Call `borrowPosition()`

        TypesV1.Position memory newPosition = TypesV1.Position({
            owner: msg.sender,
            collateralAsset: TypesV1.AssetType.Collateral,
            borrowedAsset: TypesV1.AssetType.Synthetic,
            collateralAmount: TypesV1.positiveZeroPar(),
            borrowedAmount: TypesV1.zeroPar()
        });

        // This position is saved to storage to make the logic around borrowing
        // uniform. This is slightly gas inefficient but ok given the ability to
        // ensure no diverging logic.

        uint256 positionId = state.savePosition(newPosition);

        newPosition = borrow(
            positionId,
            collateralAmount,
            borrowAmount
        );

        return (
            newPosition,
            positionId
        );
    }

    /**
     * @dev Borrow against an existing position.
     *
     * @param positionId ID of the position you'd like to borrow against
     * @param collateralAmount Collateral deposit amount
     * @param borrowAmount How much would you'd like to borrow/mint
     */
    function borrow(
        uint256 positionId,
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        internal
        returns (TypesV1.Position memory)
    {
        // CHECKS:
        // 1. Ensure that the position actually exists
        // 2. Ensure the position is collateralised before borrowing against it
        // 3. Ensure that msg.sender == owner of position
        // 4. Determine if there's enough liquidity of the `borrowAsset`
        // 5. Calculate the amount of collateral actually needed given the `collateralRatio`
        // 6. Ensure the user has provided enough of the collateral asset

        // EFFECTS:
        // 1. Increase the collateral amount to calculate the maximum the amount the user can borrow
        // 2. Calculate the proportional new par value based on the borrow amount
        // 3. Update the total supplied collateral amount
        // 4. Calculate the collateral needed and ensuring the position has that much

        // INTERACTIONS:
        // 1. Mint the synthetic asset
        // 2. Transfer the collateral to the synthetic token itself.
        //    This ensures on Etherscan people can see how much collateral is backing
        //    the synthetic

        // Get the current position
        TypesV1.Position memory position = state.getPosition(positionId);

        // Ensure it's collateralized
        require(
            state.isCollateralized(position) == true,
            "borrowPosition(): position is not collateralised"
        );

        require(
            position.owner == msg.sender,
            "borrowPosition(): must be a valid position"
        );

        Decimal.D256 memory currentPrice = state.getCurrentPrice();

        // Increase the user's collateral amount
        position = state.updatePositionAmount(
            positionId,
            position.collateralAsset,
            TypesV1.Par({
                sign: true,
                value: collateralAmount.to128()
            })
        );

        state.updateTotalSupplied(collateralAmount);

        // Only if they're borrowing
        if (borrowAmount > 0) {
            // Calculate the new borrow amount
            TypesV1.Par memory newPar = position.borrowedAmount.add(
                TypesV1.Par({
                    sign: false,
                    value: borrowAmount.to128()
                })
            );

            // Update the position's borrow amount
            position = state.setAmount(
                positionId,
                position.borrowedAsset,
                newPar
            );

            // Check how much collateral they need based on their new position details
            TypesV1.Par memory collateralRequired = state.calculateInverseRequired(
                position.borrowedAsset,
                position.borrowedAmount.value,
                currentPrice
            );

            // Ensure the user's collateral amount is greater than the collateral needed
            require(
                position.collateralAmount.value >= collateralRequired.value,
                "borrowPosition(): not enough collateral provided"
            );
        }

        IERC20 syntheticAsset = IERC20(state.syntheticAsset());
        IERC20 collateralAsset = IERC20(state.collateralAsset());

        // Transfer the collateral asset to the synthetic contract
        SafeERC20.safeTransferFrom(
            collateralAsset,
            msg.sender,
            address(syntheticAsset),
            collateralAmount
        );

        // Mint the synthetic token to user opening the borrow position
        ISyntheticToken(address(syntheticAsset)).mint(
            msg.sender,
            borrowAmount
        );

        return position;
    }

    /**
     * @dev Repay money against a borrowed position. When this process occurs the position's
     *      debt will be reduced and in turn will allow them to withdraw their collateral should they choose.
     *
     * @param positionId ID of the position to repay
     * @param repayAmount Amount of collateral to repay
     * @param withdrawAmount Amount of collateral to withdraw
     */
    function repay(
        uint256 positionId,
        uint256 repayAmount,
        uint256 withdrawAmount
    )
        private
        returns (TypesV1.Position memory)
    {
        // CHECKS:
        // 1. Ensure the position actually exists by ensuring the owner == msg.sender
        // 2. The position does not have to be collateralised since we want people to repay
        //    before a liquidator does if they do actually have a chance

        // EFFECTS:
        // 1. Calculate the new par value of the position based on the amount paid back
        // 2. Update the position's new borrow amount
        // 3. Calculate how much collateral you need based on your current position balance
        // 4. If the amount being withdrawn is less than or equal to amount withdrawn you're good

        // INTERACTIONS:
        // 1. Burn the synthetic asset directly from their wallet
        // 2.Transfer the stable coins back to the user
        TypesV1.Position memory position = state.getPosition(positionId);

        Decimal.D256 memory currentPrice = state.getCurrentPrice();

        require(
            position.owner == msg.sender,
            "repay(): must be a valid position"
        );

        // Calculate the user's new borrow requirements after decreasing their debt
        // An positive wei value will reduce the negative wei borrow value
        TypesV1.Par memory newPar = position.borrowedAmount.add(
            TypesV1.Par({
                sign: true,
                value: repayAmount.to128()
            })
        );

        // Update the position's new borrow amount
        position = state.setAmount(positionId, position.borrowedAsset, newPar);

        // Calculate how much the user is allowed to withdraw given their debt was repaid
        (TypesV1.Par memory collateralDelta) = state.calculateCollateralDelta(
            position.borrowedAsset,
            position.collateralAmount,
            position.borrowedAmount,
            currentPrice
        );

        // Ensure that the amount they are trying to withdraw is less than their limit
        require(
            withdrawAmount <= collateralDelta.value,
            "repay(): cannot withdraw more than you're allowed"
        );

        // Decrease the collateral amount of the position
        position = state.updatePositionAmount(
            positionId,
            position.collateralAsset,
            TypesV1.Par({
                sign: false,
                value: withdrawAmount.to128()
            })
        );

        ISyntheticToken synthetic = ISyntheticToken(state.syntheticAsset());
        IERC20 collateralAsset = IERC20(state.collateralAsset());

        // Burn the synthetic asset from the user
        synthetic.burn(
            msg.sender,
            repayAmount
        );

        // Transfer collateral back to the user
        bool transferResult = synthetic.transferCollateral(
            address(collateralAsset),
            msg.sender,
            withdrawAmount
        );

        require(
            transferResult == true,
            "repay(): collateral failed to transfer"
        );

        return position;
    }

    /**
     * @dev Liquidate a user's position. When this process occurs you're essentially
     *      purchasing the users's debt at a discount (liquidation spread) in exchange
     *      for the collateral they have deposited inside their position.
     *
     * @param positionId ID of the position to liquidate
     */
    function liquidate(
        uint256 positionId
    )
        private
        returns (TypesV1.Position memory)
    {
        // CHECKS:
        // 1. Ensure that the position id is valid
        // 2. Check the status of the position, only if it's undercollateralized you can call this

        // EFFECTS:
        // 1. Calculate the liquidation price price based on the liquidation penalty
        // 2. Calculate how much the user is in debt by
        // 3. Add the liquidation penalty on to the liquidation amount so they have some
        //    margin of safety to make sure they don't get liquidated again
        // 4. If the collateral to liquidate is greater than the collateral, bound it.
        // 5. Calculate how much of the borrowed asset is to be liquidated based on the collateral delta
        // 6. Decrease the user's debt obligation by that amount
        // 7. Update the new borrow and collateral amounts

        // INTERACTIONS:
        // 1. Burn the synthetic asset from the liquidator
        // 2. Transfer the collateral from the synthetic token to the liquidator
        // 3. Transfer a portion to the ARC Core contract as a fee

        TypesV1.Position memory position = state.getPosition(positionId);

        require(
            position.owner != address(0),
            "liquidatePosition(): must be a valid position"
        );

        // Ensure that the position is not collateralized
        require(
            state.isCollateralized(position) == false,
            "liquidatePosition(): position is collateralised"
        );

        // Get the liquidation price of the asset (discount for liquidator)
        Decimal.D256 memory liquidationPrice = state.calculateLiquidationPrice(
            position.collateralAsset
        );

        // Calculate how much the user is in debt by to be whole again at a discounted price
        (TypesV1.Par memory liquidationCollateralDelta) = state.calculateCollateralDelta(
            position.borrowedAsset,
            position.collateralAmount,
            position.borrowedAmount,
            liquidationPrice
        );

        // Liquidate a slight bit more to ensure the user is guarded against futher price drops
        liquidationCollateralDelta.value = Decimal.mul(
            liquidationCollateralDelta.value,
            Decimal.add(
                state.totalLiquidationSpread(),
                Decimal.one().value
            )
        ).to128();

        // Calculate how much collateral this is going to cost the liquidator
        // The sign is negative since we need to subtract from the liquidation delta
        // which is a negative sign and subtracting a negative will actuall add it
        (TypesV1.Par memory liquidatorCollateralCost) = TypesV1.Par({
            sign: false,
            value: Decimal.mul(
                liquidationCollateralDelta.value,
                Decimal.sub(
                    Decimal.one(),
                    state.totalLiquidationSpread().value
                )
            ).to128()
        });

        // If the maximum they're down by is greater than their collateral, bound to the maximum
        if (liquidationCollateralDelta.value > position.collateralAmount.value) {
            liquidationCollateralDelta.value = position.collateralAmount.value;

            // If the the original collateral delta is to be the same as the
            // collateral amount. What this does is that the profit calculated
            // will be 0 since the liquidationCollateralDelta less the
            // originalCollateralDelta will be the same.
            liquidatorCollateralCost.value = position.collateralAmount.value;
        }

        // Calculate how much borrowed assets to liquidate (at a discounted price)
        uint256 borrowToLiquidate = state.calculateInverseAmount(
            position.collateralAsset,
            liquidationCollateralDelta.value,
            liquidationPrice
        );

        // Decrease the user's debt obligation
        // This amount is denominated in par since collateralDelta uses the borrow index
        TypesV1.Par memory newPar = position.borrowedAmount.add(
            TypesV1.Par({
                sign: true,
                value: borrowToLiquidate.to128()
            })
        );

        // Set the user's new borrow amount
        position = state.setAmount(positionId, position.borrowedAsset, newPar);

        // Decrease their collateral amount by the amount they were missing
        position = state.updatePositionAmount(
            positionId,
            position.collateralAsset,
            liquidationCollateralDelta
        );

        address borrowAddress = state.getAddress(position.borrowedAsset);

        require(
            IERC20(borrowAddress).balanceOf(msg.sender) >= borrowToLiquidate,
            "liquidatePosition(): msg.sender not enough of borrowed asset to liquidate"
        );

        _settleLiquidation(
            borrowToLiquidate,
            liquidationCollateralDelta,
            liquidatorCollateralCost
        );

        return position;
    }

    function _settleLiquidation(
        uint256 borrowToLiquidate,
        TypesV1.Par memory liquidationCollateralDelta,
        TypesV1.Par memory liquidatorCollateralCost
    )
        private
    {
        ISyntheticToken synthetic = ISyntheticToken(
            state.syntheticAsset()
        );

        IERC20 collateralAsset = IERC20(state.collateralAsset());

        (
            /* solium-disable-next-line */
            Decimal.D256 memory userSplit,
            Decimal.D256 memory arcSplit
        ) = state.calculateLiquidationSplit();

        // Burn the synthetic asset from the liquidator
        synthetic.burn(
            msg.sender,
            borrowToLiquidate
        );

        // This is the actual profit collected from the liquidation
        TypesV1.Par memory collateralProfit = liquidationCollateralDelta.sub(
            liquidatorCollateralCost
        );

        // ARC's profit is simple a percentage of the profit, not net total
        uint256 arcProfit = Decimal.mul(
            collateralProfit.value,
            arcSplit
        );

        // Transfer them the collateral assets they acquired at a discount
        bool userTransferResult = synthetic.transferCollateral(
            address(collateralAsset),
            msg.sender,
            uint256(liquidationCollateralDelta.value).sub(arcProfit)
        );

        require(
            userTransferResult == true,
            "liquidate(): collateral failed to transfer to user"
        );

        // Transfer ARC the collateral asset acquired at a discount
        bool arcTransferResult = synthetic.transferCollateral(
            address(collateralAsset),
            address(this),
            arcProfit
        );

        require(
            arcTransferResult == true,
            "liquidate(): collateral failed to transfer to arc"
        );
    }

}
