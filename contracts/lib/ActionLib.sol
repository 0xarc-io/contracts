pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Types} from "./Types.sol";
import {Decimal} from "./Decimal.sol";
import {SignedMath} from "./SignedMath.sol";
import {Interest} from "./Interest.sol";
import {Math} from "../lib/Math.sol";

import {console} from "@nomiclabs/buidler/console.sol";

library ActionLib {

    using SafeMath for uint256;
    using Math for uint256;
    using Types for Types.Par;
    using Types for Types.Wei;

    function borrow(
        Types.Position storage position,
        Types.GlobalParams memory params,
        uint256 collateralAmount,
        uint256 borrowAmount,
        Interest.Index memory borrowIndex
    )
        internal
        returns (Types.Par memory newBorrow)
    {
        require(
            borrowAmount > 0,
            "Action.borrowPosition(): borrowAmount cannot be 0"
        );

        require(
            position.owner == msg.sender,
            "Action.borrowPosition(): must be a valid position"
        );

        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

        uint256 collateralRequired = Types.calculateInverseRequired(
            position.borrowedAsset,
            params,
            borrowAmount,
            currentPrice
        );

        console.log("Collateral required: %s", collateralRequired);

        require(
            collateralAmount >= collateralRequired,
            "Action.openPosition(): not enough collateral provided"
        );

        (Types.Par memory newPar, ) = Types.getNewParAndDeltaWei(
            position.borrowedAmount,
            borrowIndex,
            Types.AssetAmount({
                sign: false,
                denomination: Types.AssetDenomination.Par,
                ref: Types.AssetReference.Delta,
                value: borrowAmount
            })
        );

        position.borrowedAmount = newPar;
        position.collateralAmount.value += collateralAmount.to128();

        return newPar;
    }

    function liquidate(
        Types.Position storage position,
        Types.GlobalParams memory params,
        Interest.Index memory borrowIndex
    )
        internal
        returns (
            uint256 borrowToLiquidate,
            uint256 collateralToLiquidate,
            Types.Par memory newBorrow
        )
    {
        require(
            position.owner != address(0),
            "Actions.liquidatePosition(): must be a valid position"
        );

        Decimal.D256 memory liquidationPrice = Types.calculateLiquidationPrice(
            position.collateralAsset,
            params
        );

        (SignedMath.Int memory collateralDelta) = Types.calculateCollateralDelta(
            position.borrowedAsset,
            params,
            position.collateralAmount,
            position.borrowedAmount,
            borrowIndex,
            liquidationPrice
        );

        if (collateralDelta.value > position.collateralAmount.value) {
            collateralDelta.value = position.collateralAmount.value;
        }

        borrowToLiquidate = Types.calculateInverseAmount(
            position.collateralAsset,
            collateralDelta.value,
            liquidationPrice
        );

        (Types.Par memory newPar, ) = Types.getNewParAndDeltaWei(
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

        return(
            borrowToLiquidate,
            collateralDelta.value,
            newPar
        );
    }

}