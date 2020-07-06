pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {BaseERC20} from "../token/BaseERC20.sol";

import {Storage} from "./Storage.sol";

contract Actions is Storage {

    using SafeMath for uint256;

    // ============ Functions ============

    function supply(
        uint256 amount
    )
        public
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

        // CHECKS:

        require(
            amount > 0,
            "Actions.supply(): cannot supply 0"
        );

        require(
            params.stableAsset.balanceOf(msg.sender) >= amount,
            "Actions.supply(): must have enough balance"
        );

        // EFFECTS:

        Types.Par memory existingPar = supplyBalances[msg.sender];

        (Types.Par memory newPar, Types.Wei memory deltaWei) = getNewParAndDeltaWei(
            existingPar,
            Types.AssetAmount({
                sign: true,
                denomination: Types.AssetDenomination.Par,
                ref: Types.AssetReference.Delta,
                value: amount
            })
        );

        updateTotalPar(existingPar, newPar);
        supplyBalances[msg.sender] = newPar;

        updateIndex();

        // INTERACTIONS:

        params.stableAsset.transferFrom(
            msg.sender,
            address(this),
            deltaWei.value
        );

    }

    function withdraw(
        uint256 amount
    )
        public
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
        address collateralAsset,
        uint256 borrowAmount
    )
        public
    {
        // CHECKS:
        // 1. `collateralAsset` should be a valid asset
        // 2. Check the user has enough of the collateral asset

        // EFFECTS:
        // 1. Create a new Position struct with the basic fields filled out and save it to storage
        // 2. Call `borrowPosition()`
    }

    function borrowPosition(
        uint256 positionId,
        uint256 borrowAmount
    )
        public
    {
        // CHECKS:
        // 1. `borrowAmount` should be greater than 0
        // 2. Ensure that the position actually exists
        // 3. Ensure that msg.sender == owner of position
        // 4. Figure out `borrowAsset` based on collateral assset
        //    If stable shares are the collateral, synthetic are the borrow.
        //    If synthetics are the collateral, stable shares are the borrow
        // 5. Determine if there's enough liquidity of the `borrowAsset`
        // 6. Calculate the amount of collateral actually needed given the `collateralRatio`

        // EFFECTS:
        // 1. If synthetics are being borrowed, do nothing (skip to interactions).
        // 2. If stable shares are being borrowed, calculate the proportional
        //    new par value based on the borrow amount and set that as the borrow par value.
        // 3. Update the global index with the increased borrow amount

        // INTERACTIONS:
        // 1. If stable shares are being borrowed, transfer them to the user
        //    If synthetics are being borrowed, mint them and transfer collateral to synthetic contract
    }

    function depositPosition(
        uint256 positionId,
        uint256 depositAmount,
        bool shouldClose
    )
        public
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

    function liquidatePosition(
        uint256 positionId
    )
        public
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
    }

}
