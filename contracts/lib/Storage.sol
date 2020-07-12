pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {console} from "@nomiclabs/buidler/console.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Helpers} from "../lib/Helpers.sol";
import {Interest} from "../lib/Interest.sol";
import {Math} from "../lib/Math.sol";
import {Time} from "../lib/Time.sol";
import {SignedMath} from "../lib/SignedMath.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

library Storage {

    using Types for Types.Par;
    using Types for Types.Wei;
    using Math for uint256;
    using SafeMath for uint256;
    using Storage for Storage.State;

    // ============ Variables ============

    struct State {
        Types.GlobalParams params;
        ISyntheticToken synthetic;

        Types.TotalPar totalPar;
        Interest.Index index;

        uint256 positionCount;

        mapping (uint256 => Types.Position) positions;
        mapping (address => Types.Par) supplyBalances;
    }

    // ============ Setters ============

    function updateTotalPar(
        Storage.State storage state,
        Types.Par memory existingPar,
        Types.Par memory newPar
    )
        internal
    {
        if (Types.equals(existingPar, newPar)) {
            return;
        }

        // updateTotalPar
        Types.TotalPar memory totalPar = state.totalPar;

        // roll-back oldPar
        if (existingPar.sign) {
            totalPar.supply = uint256(totalPar.supply).sub(existingPar.value).to128();
        } else {
            totalPar.borrow = uint256(totalPar.borrow).sub(existingPar.value).to128();
        }

        // roll-forward newPar
        if (newPar.sign) {
            totalPar.supply = uint256(totalPar.supply).add(newPar.value).to128();
        } else {
            totalPar.borrow = uint256(totalPar.borrow).add(newPar.value).to128();
        }

        state.totalPar = totalPar;
    }

    function updateIndex(
        Storage.State storage state
    )
        internal
        returns (Interest.Index memory)
    {
        Interest.Index memory index = state.index;

        if (index.lastUpdate == Time.currentTime()) {
            return index;
        }

        return state.index = state.fetchNewIndex(index);
    }

    // ============ Getters ============

    function getNewParAndDeltaWei(
        Storage.State storage state,
        Types.Par memory currentPar,
        Interest.Index memory index,
        Types.AssetAmount memory amount
    )
        internal
        view
        returns (Types.Par memory, Types.Wei memory)
    {
        if (amount.value == 0 && amount.ref == Types.AssetReference.Delta) {
            return (currentPar, Types.zeroWei());
        }

        Types.Wei memory oldWei = Interest.parToWei(currentPar, index);
        Types.Par memory newPar;
        Types.Wei memory deltaWei;

        if (amount.denomination == Types.AssetDenomination.Wei) {
            deltaWei = Types.Wei({
                sign: amount.sign,
                value: amount.value
            });
            if (amount.ref == Types.AssetReference.Target) {
                deltaWei = deltaWei.sub(oldWei);
            }
            newPar = Interest.weiToPar(oldWei.add(deltaWei), index);
        } else { // AssetDenomination.Par
            newPar = Types.Par({
                sign: amount.sign,
                value: amount.value.to128()
            });
            if (amount.ref == Types.AssetReference.Delta) {
                newPar = currentPar.add(newPar);
            }
            deltaWei = Interest.parToWei(newPar, index).sub(oldWei);
        }

        return (newPar, deltaWei);
    }

    function fetchNewIndex(
        Storage.State storage state,
        Interest.Index memory index
    )
        internal
        view
        returns (Interest.Index memory)
    {
        Interest.Rate memory rate = state.fetchInterestRate(index);

        return Interest.calculateNewIndex(
            index,
            rate,
            state.totalPar,
            state.params.earningsRate
        );
    }

    function fetchInterestRate(
        Storage.State storage state,
        Interest.Index memory index
    )
        internal
        view
        returns (Interest.Rate memory)
    {
        Types.TotalPar memory totalPar = state.totalPar;

        (
            Types.Wei memory supplyWei,
            Types.Wei memory borrowWei
        ) = Interest.totalParToWei(totalPar, index);

        Interest.Rate memory rate = state.params.interestSetter.getInterestRate(
            address(state.synthetic),
            borrowWei.value,
            supplyWei.value
        );

        return rate;
    }

    function getAddress(
        Storage.State storage state,
        Types.AssetType asset
    )
        internal
        view
        returns (address)
    {
        return asset == Types.AssetType.Stable ?
            address(state.params.stableAsset) :
            address(state.synthetic);
    }

    function getBorrowIndex(
        Storage.State storage state,
        Types.AssetType asset
    )
        internal
        view
        returns (Interest.Index memory)
    {
        if (asset == Types.AssetType.Stable) {
            return state.index;
        } else {
            return Interest.newIndex();
        }
    }

    function isCollateralized(
        Storage.State storage state,
        Types.Position memory position
    )
        internal
        view
        returns (bool)
    {
        Decimal.D256 memory currentPrice = state.params.oracle.fetchCurrentPrice();

        (SignedMath.Int memory collateralDelta) = state.calculateCollateralDelta(
            position.borrowedAsset,
            state.params,
            position.collateralAmount,
            position.borrowedAmount,
            state.getBorrowIndex(position.borrowedAsset),
            currentPrice
        );

        return collateralDelta.isPositive;
    }

    function calculateInverseAmount(
        Storage.State storage state,
        Types.AssetType asset,
        uint256 amount,
        Decimal.D256 memory price
    )
        internal
        view
        returns (uint256)
    {
        uint256 borrowRequired;

        if (asset == Types.AssetType.Stable) {
            borrowRequired = Decimal.div(
                amount,
                price
            );
        } else if (asset == Types.AssetType.Synthetic) {
            borrowRequired = Decimal.mul(
                amount,
                price
            );
        }

        return borrowRequired;
    }

    function calculateInverseRequired(
        Storage.State storage state,
        Types.AssetType asset,
        Types.GlobalParams memory params,
        uint256 amount,
        Decimal.D256 memory price
    )
        internal
        view
        returns (uint256)
    {

        uint256 collateralRequired = state.calculateInverseAmount(
            asset,
            amount,
            price
        );

        if (asset == Types.AssetType.Stable) {
            collateralRequired = Decimal.mul(
                collateralRequired,
                params.syntheticRatio
            );

        } else if (asset == Types.AssetType.Synthetic) {
            collateralRequired = Decimal.mul(
                collateralRequired,
                params.collateralRatio
            );
        }

        return collateralRequired;
    }

    function calculateLiquidationPrice(
        Storage.State storage state,
        Types.AssetType asset,
        Types.GlobalParams memory params
    )
        internal
        view
        returns (Decimal.D256 memory price)
    {
        Decimal.D256 memory result;
        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

        if (asset == Types.AssetType.Stable) {
            result = Decimal.add(
                Decimal.one(),
                params.liquidationSpread.value
            );
        } else if (asset == Types.AssetType.Synthetic) {
            result = Decimal.sub(
                Decimal.one(),
                params.liquidationSpread.value
            );
        }

        result = Decimal.mul(
            currentPrice,
            result
        );

        return result;
    }

    function calculateCollateralDelta(
        Storage.State storage state,
        Types.AssetType borrowedAsset,
        Types.GlobalParams memory params,
        Types.Par memory parSupply,
        Types.Par memory parBorrow,
        Interest.Index memory borrowIndex,
        Decimal.D256 memory price
    )
        internal
        view
        returns (SignedMath.Int memory)
    {
        SignedMath.Int memory collateralDelta;

        uint256 collateralRequired;

        Types.Wei memory weiBorrow = Types.getWei(
            parBorrow,
            borrowIndex
        );

        console.log("Wei borrow: %s", weiBorrow.value);

        if (borrowedAsset == Types.AssetType.Stable) {
            collateralRequired = state.calculateInverseRequired(
                borrowedAsset,
                params,
                weiBorrow.value,
                price
            );
        } else if (borrowedAsset == Types.AssetType.Synthetic) {
            collateralRequired = state.calculateInverseRequired(
                borrowedAsset,
                params,
                weiBorrow.value,
                price
            );
        }

        console.log("Par supply: %s", parSupply.value);

        // If the amount you've supplied is greater than the collateral needed
        // given your borrow amount, then you're positive
        if (parSupply.value >= collateralRequired) {
            collateralDelta = SignedMath.Int({
                isPositive: true,
                value: uint256(parSupply.value).sub(collateralRequired)
            });
        } else {
            // If not, subtract the collateral needed from the amount supplied
            collateralDelta = SignedMath.Int({
                isPositive: false,
                value: collateralRequired.sub(uint256(parSupply.value))
            });
        }

        console.log("Collateral delta: %s %s", collateralDelta.isPositive, collateralDelta.value);

        return collateralDelta;
    }
}
