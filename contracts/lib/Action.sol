pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {Math} from "../lib/Math.sol";

import {Types} from "./Types.sol";
import {Decimal} from "./Decimal.sol";
import {SignedMath} from "./SignedMath.sol";
import {Interest} from "./Interest.sol";
import {Storage} from "./Storage.sol";
import {Settlement} from "./Settlement.sol";

library Action {

    using SafeMath for uint256;
    using Math for uint256;
    using Types for Types.Par;
    using Types for Types.Wei;
    using Storage for Storage.State;
    using Action for Action;

    enum Operation {
        Supply,
        Withdraw,
        Open,
        Borrow,
        Deposit,
        Liquidate
    }

    struct OperationParams {
        uint256 id;
        Types.AssetType assetOne;
        uint256 amountOne;
        Types.AssetType assetTwo;
        uint256 amountTwo;
    }

    function operateAction(
        Storage.State storage state,
        Operation operation,
        OperationParams memory params
    )
        internal
    {
        if (operation == Operation.Supply) {
            supply(
                state,
                params.amountOne
            );
        } else if (operation == Operation.Withdraw) {
            withdraw(
                state,
                params.amountOne
            );
        } else if (operation == Operation.Open) {
            openPosition(
                state,
                params.assetOne,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Borrow) {
            borrow(
                state,
                params.id,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Deposit) {
            deposit(
                state,
                params.id,
                params.assetOne,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Liquidate) {
            liquidate(
                state,
                params.id
            );
        }

        state.updateIndex();
    }

    function supply(
        Storage.State storage state,
        uint256 amount
    )
        private
    {
        // CHECKS:
        // 1. `amount` > 0
        // 2. user should have enough balance to deposit tokens

        // EFFECTS
        // 1. Calculate par value given current supply index
        // 2. Update par balance of user
        // 3. Update total par balance of state
        // 4. Update index given new supplies

        // INTERACTIONS:
        // 1. Transfer stable shares to this contract

        console.log("supply(amount: %s)", amount);

        require(
            amount > 0,
            "Actions.supply(): cannot supply 0"
        );

        require(
            state.params.stableAsset.balanceOf(msg.sender) >= amount,
            "Actions.supply(): must have enough balance"
        );

        Types.Par memory existingPar = state.supplyBalances[msg.sender];

        (Types.Par memory newPar, Types.Wei memory deltaWei) = state.getNewParAndDeltaWei(
            existingPar,
            state.index,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Wei,
                ref: Types.AssetReference.Delta,
                value: amount
            })
        );

        state.updateTotalPar(existingPar, newPar);
        state.supplyBalances[msg.sender] = newPar;

        SafeERC20.safeTransferFrom(
            state.params.stableAsset,
            msg.sender,
            address(this),
            deltaWei.value
        );
    }

    function withdraw(
        Storage.State storage state,
        uint256 amount
    )
        private
    {

        // CHECKS:
        // 1. `amount` > 0
        // 2. Calculate wei balance of user given current supply index
        // 3. `amount` > wei balance of user
        // 4. Check that there's enough available liquidity

        // EFFECTS:
        // 1. Calculate new par value given withdrawl
        // 2. Update par balance of user
        // 3. Update total par balance of state
        // 4. Update index given new supplies

        // INTERACTIONS:
        // 1. Transfer stable shares back to user
    }

    function openPosition(
        Storage.State storage state,
        Types.AssetType collateralAsset,
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        private
    {
        // CHECKS:
        // 1. `collateralAsset` should be a valid asset
        // 2. Check the user has enough of the collateral asset
        // 3. Figure out `borrowAsset` based on collateral assset
        //    If stable shares are the collateral, synthetic are the borrow.
        //    If synthetics are the collateral, stable shares are the borrow

        // EFFECTS:
        // 1. Create a new Position struct with the basic fields filled out and save it to storage
        // 2. Call `borrowPosition()`


        require(
            collateralAsset <= Types.AssetType.Synthetic,
            "Actions.openPosition(): must be a synthetic or stable asset"
        );

        Types.Position memory newPosition = Types.Position({
            owner: msg.sender,
            collateralAsset: collateralAsset,
            borrowedAsset: Types.oppositeAsset(collateralAsset),
            collateralAmount: Types.positiveZeroPar(),
            borrowedAmount: Types.zeroPar()
        });

        state.positions[state.positionCount] = newPosition;

        Action.borrow(
            state,
            state.positionCount,
            collateralAmount,
            borrowAmount
        );

        state.positionCount++;
    }

    function borrow(
        Storage.State storage state,
        uint256 positionId,
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        internal
    {
        // CHECKS:
        // 1. `borrowAmount` should be greater than 0
        // 2. Ensure that the position actually exists
        // 3. Ensure that msg.sender == owner of position
        // 4. Determine if there's enough liquidity of the `borrowAsset`
        // 5. Calculate the amount of collateral actually needed given the `collateralRatio`
        // 6. Ensure the user has provided enough of the

        // EFFECTS:
        // 1. If synthetics are being borrowed, update the position and skip to interactions.
        // 2. If stable shares are being borrowed, calculate the proportional
        //    new par value based on the borrow amount and set that as the borrow par value.
        // 3. Update the global index with the increased borrow amount

        // INTERACTIONS:
        // 1. If stable shares are being borrowed, transfer them to the user
        //    If synthetics are being borrowed, mint them and transfer collateral to synthetic contract

        console.log(
            "borrowPosition(positionId: %s, collateralAmount: %s, borrowAmount: %s)",
            positionId,
            collateralAmount,
            borrowAmount
        );

        Types.Position storage position = state.positions[positionId];

        require(
            state.isCollateralized(position) == true,
            "Action.borrowPosition(): position is not collateralised"
        );

        require(
            position.owner == msg.sender,
            "Action.borrowPosition(): must be a valid position"
        );

        Decimal.D256 memory currentPrice = state.params.oracle.fetchCurrentPrice();

        uint256 collateralRequired = state.calculateInverseRequired(
            position.borrowedAsset,
            state.params,
            borrowAmount,
            currentPrice
        );

        console.log("Collateral required: %s", collateralRequired);

        require(
            collateralAmount >= collateralRequired,
            "Action.openPosition(): not enough collateral provided"
        );

        (Types.Par memory newPar, ) = state.getNewParAndDeltaWei(
            position.borrowedAmount,
            state.getBorrowIndex(position.borrowedAsset),
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Par,
                ref: Types.AssetReference.Delta,
                value: borrowAmount
            })
        );

        position.borrowedAmount = newPar;
        position.collateralAmount.value += collateralAmount.to128();

        if (position.borrowedAsset == Types.AssetType.Stable) {
            state.updateTotalPar(position.borrowedAmount, newPar);
        }

        Settlement.borrow(
            state.params,
            state.synthetic,
            position.borrowedAsset,
            collateralAmount,
            borrowAmount
        );
    }

    function deposit(
        Storage.State storage state,
        uint256 positionId,
        Types.AssetType depositAsset,
        uint256 depositAmount,
        uint256 withdrawAmount
    )
        private
    {
        // CHECKS:
        // 1. Ensure the position actually exists
        // 2. `depositAmount` is greater than 0
        // 3. Determine the asset being deposited based on the position
        // 4. Ensure user has enough balance of deposit asset
        // 5. Calculate the wei debt value of the position (assuming stable shares were borrowed)
        // 6. If the user has set the deposit amount more than or equal to the deposit amount
        //    then `canClose` should be set to true (assuming `shouldClose` == true)

        // EFFECTS:
        // 1. Calculate the new par value of the position based on the amount paid back
        // 2. Update the position's borrow amount based on the amount paid back
        // 3. Update the global par and wei values
        // 4. Update the global index

        // INTERACTIONS:
        // 1. If stable shares are being deposited, transfer the synthetic from them
        //    and take the stable coins back from them
        // 2. If synthetics are being deposited, burn the synthetic from them and
        //    transfer the stable coins back to them
    }

    function liquidate(
        Storage.State storage state,
        uint256 positionId
    )
        private
    {
        // CHECKS:
        // 1. Ensure that the position id is valid
        // 2. Check the status of the position, only if it's in trouble
        //    can this function be called
        // 3. Determine which asset is the user under in
        // 4. Calculate how much the user is down by
        //    - If synthetics are being borrowed then they need to cover the user's synthetic position
        //    - If stable share are being borrowed, then they need to cover the user's stable position
        // 5. Ensure the liquidator (msg.sender) has enough of the asset they're attacking the user for

        // EFFECTS:
        // 1. Update the new par values of the position based on how much is liquidated
        // 2. Update the global par and wei values
        // 3. Update the global index based

        // INTERACTIONS:
        // 1. If stable shares were being borrowed, transfer the synthetic to the liquidator
        // 2. If synthetics were being borrowed, transfer stable shares to the liquidator
        console.log("liquidatePosition(positionId: %s)", positionId);

        Types.Position storage position = state.positions[positionId];

        require(
            position.owner != address(0),
            "Actions.liquidatePosition(): must be a valid position"
        );

        require(
            state.isCollateralized(position) == false,
            "Action.borrowPosition(): position is collateralised"
        );

        Decimal.D256 memory liquidationPrice = state.calculateLiquidationPrice(
            position.collateralAsset,
            state.params
        );


        Interest.Index memory borrowIndex = state.getBorrowIndex(position.borrowedAsset);

        (SignedMath.Int memory collateralDelta) = state.calculateCollateralDelta(
            position.borrowedAsset,
            state.params,
            position.collateralAmount,
            position.borrowedAmount,
            borrowIndex,
            liquidationPrice
        );

        if (collateralDelta.value > position.collateralAmount.value) {
            collateralDelta.value = position.collateralAmount.value;
        }

        uint256 borrowToLiquidate = state.calculateInverseAmount(
            position.collateralAsset,
            collateralDelta.value,
            liquidationPrice
        );

        (Types.Par memory newPar, ) = state.getNewParAndDeltaWei(
            position.borrowedAmount,
            borrowIndex,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Par,
                ref: Types.AssetReference.Delta,
                value: borrowToLiquidate
            })
        );

        position.borrowedAmount = newPar;
        position.collateralAmount.value -= collateralDelta.value.to128();

        address borrowAddress = state.getAddress(position.borrowedAsset);

        require(
            IERC20(borrowAddress).balanceOf(msg.sender) >= borrowToLiquidate,
            "Action.liquidatePosition(): msg.sender not enough of borrowed asset to liquidate"
        );

        if (position.borrowedAsset == Types.AssetType.Stable) {
            state.updateTotalPar(position.borrowedAmount, newPar);
        }

        Settlement.liquidate(
            state.params,
            state.synthetic,
            position.borrowedAsset,
            collateralDelta.value,
            borrowToLiquidate
        );
    }

}