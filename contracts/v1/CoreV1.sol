// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IMintableToken} from "../interfaces/IMintableToken.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {TypesV1} from "./TypesV1.sol";
import {Decimal} from "../lib/Decimal.sol";
import {SignedMath} from "../lib/SignedMath.sol";
import {Storage} from "../lib/Storage.sol";
import {Math} from "../lib/Math.sol";
import {Adminable} from "../lib/Adminable.sol";

import {StateV1} from "./StateV1.sol";
import {StorageV1} from "./StorageV1.sol";

contract CoreV1 is StorageV1, Adminable {

    using SafeMath for uint256;
    using Math for uint256;
    using TypesV1 for TypesV1.Par;

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

    // ============ Constructor ============

    function init(address _state)
        external
    {
        require(
            address(state) == address(0),
            "CoreV1.init(): cannot recall init"
        );

        state = StateV1(_state);
    }

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
     * @dev Borrow against an existing position
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
        // 6. Ensure the user has provided enough of the

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

            console.log("borrow new par: %s", newPar.value);

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

            console.log("collateral required: %s", collateralRequired.value);
            console.log("current collateral amount: %s", position.collateralAmount.value);

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
     * @dev Repay money against a borrowed position
     *
     * @param positionID ID of the position to repay
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
        // 2. Ensure the position is sufficiently collateralized

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

        // Ensure the user has a collateralised position when depositing
        require(
            state.isCollateralized(position) == true,
            "repay(): position is not collateralised"
        );

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
        synthetic.transferCollateral(
            address(collateralAsset),
            msg.sender,
            withdrawAmount
        );

        return position;
    }

    /**
     * @dev Liquidate a user's position
     *
     * @param positionID ID of the position to liquidate
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
        // 4. If the collateral to liquidate is greater than the collatera, bound it.
        // 5. Calculate how much of the borrowed asset is to be liquidated based on the collateral delta
        // 6. Decrease the user's debt obligation by that amount
        // 7. Update the new borrow and collateral amounts

        // INTERACTIONS:
        // 1. Burn the synthetic asset from the liquidator
        // 2. Transfer the collateral from the synthetic token to the liquidator
        // 3. Transfer a portion to the ARC Core contract as a fee

        TypesV1.Position memory position = state.getPosition(positionId);

        console.log("*** liquidate ***");
        console.log("   starting collat: %s", position.collateralAmount.value);
        console.log("   starting borrow: %s", position.borrowedAmount.value);

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

        console.log("   liquidation price", liquidationPrice.value);

        // Calculate how much the user is in debt by to be whole again
        (TypesV1.Par memory collateralDelta) = state.calculateCollateralDelta(
            position.borrowedAsset,
            position.collateralAmount,
            position.borrowedAmount,
            liquidationPrice
        );

        // Liquidate a slight bit more to ensure the user is guarded against futher price drops
        collateralDelta.value = Decimal.mul(
            collateralDelta.value,
            Decimal.add(
                state.totalLiquidationSpread(),
                Decimal.one().value
            )
        ).to128();

        console.log("   collateral delta: %s %s", collateralDelta.sign, collateralDelta.value);

        // If the maximum they're down by is greater than their collateral, bound to the maximum
        if (collateralDelta.value > position.collateralAmount.value) {
            collateralDelta.value = position.collateralAmount.value;
        }

        // Calculate how much borrowed assets to liquidate (at a discounted price)
        uint256 borrowToLiquidate = state.calculateInverseAmount(
            position.collateralAsset,
            collateralDelta.value,
            liquidationPrice
        );

        console.log("   borrow to liquidate: %s", borrowToLiquidate);

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
            collateralDelta
        );

        address borrowAddress = state.getAddress(position.borrowedAsset);

        require(
            IERC20(borrowAddress).balanceOf(msg.sender) >= borrowToLiquidate,
            "liquidatePosition(): msg.sender not enough of borrowed asset to liquidate"
        );

        ISyntheticToken synthetic = ISyntheticToken(
            state.getAddress(TypesV1.AssetType.Synthetic)
        );

        IERC20 collateralAsset = IERC20(state.collateralAsset());

        (
            Decimal.D256 memory userSplit,
            Decimal.D256 memory arcSplit
        ) = state.calculateLiquidationSplit();

        // Burn the synthetic asset from the liquidator
        synthetic.burn(
            msg.sender,
            borrowToLiquidate
        );

        // Transfer them the collateral assets they acquired at a discount
        synthetic.transferCollateral(
            address(collateralAsset),
            msg.sender,
            Decimal.mul(
                collateralDelta.value,
                userSplit
            )
        );

        // Transfer them the collateral assets they acquired at a discount
        synthetic.transferCollateral(
            address(collateralAsset),
            address(this),
            Decimal.mul(
                collateralDelta.value,
                arcSplit
            )
        );

        return position;
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
}
