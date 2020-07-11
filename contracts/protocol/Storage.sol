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

contract Storage {

    using Math for uint256;
    using SafeMath for uint256;

    // ============ Variables ============

    Types.GlobalParams public params;
    Types.State public state;

    ISyntheticToken public synthetic;

    uint256 public positionCount;

    mapping (uint256 => Types.Position) public positions;
    mapping (address => Types.Par) public supplyBalances;

    // ============ Setters ============

    function updateTotalPar(
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

    function updateIndex()
        internal
        returns (Interest.Index memory)
    {
        Interest.Index memory index = state.index;

        if (index.lastUpdate == Time.currentTime()) {
            return index;
        }

        return state.index = fetchNewIndex(index);
    }

    // ============ Getters ============

    function fetchNewIndex(
        Interest.Index memory index
    )
        internal
        view
        returns (Interest.Index memory)
    {
        Interest.Rate memory rate = fetchInterestRate(index);

        return Interest.calculateNewIndex(
            index,
            rate,
            state.totalPar,
            params.earningsRate
        );
    }

    function fetchInterestRate(
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

        Interest.Rate memory rate = params.interestSetter.getInterestRate(
            address(synthetic),
            borrowWei.value,
            supplyWei.value
        );

        return rate;
    }

    function getAddress(
        Types.AssetType asset
    )
        internal
        view
        returns (address)
    {
        return asset == Types.AssetType.Stable ?
            address(params.stableAsset) :
            address(synthetic);
    }

    function getBorrowIndex(
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
        Types.Position memory position
    )
        internal
        view
        returns (bool)
    {
        Decimal.D256 memory currentPrice = params.oracle.fetchCurrentPrice();

        (SignedMath.Int memory collateralDelta) = Types.calculateCollateralDelta(
            position.borrowedAsset,
            params,
            position.collateralAmount,
            position.borrowedAmount,
            getBorrowIndex(position.borrowedAsset),
            currentPrice
        );

        return collateralDelta.isPositive;
    }
}
