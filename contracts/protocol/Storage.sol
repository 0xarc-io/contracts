pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Helpers} from "../lib/Helpers.sol";
import {Interest} from "../lib/Interest.sol";
import {Math} from "../lib/Math.sol";
import {Time} from "../lib/Time.sol";

import {SyntheticToken} from "../token/SyntheticToken.sol";

contract Storage {

    using Types for Types.Par;
    using Types for Types.Wei;
    using Math for uint256;
    using SafeMath for uint256;

    // ============ Variables ============

    Types.GlobalParams public params;
    Types.State public state;

    SyntheticToken public synthetic;

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

    function getNewParAndDeltaWei(
        Types.Par memory currentPar,
        Types.AssetAmount memory amount
    )
        internal
        view
        returns (Types.Par memory, Types.Wei memory)
    {
        if (amount.value == 0 && amount.ref == Types.AssetReference.Delta) {
            return (currentPar, Types.zeroWei());
        }

        Types.Wei memory oldWei = Interest.parToWei(currentPar, state.index);
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
            newPar = Interest.weiToPar(oldWei.add(deltaWei), state.index);
        } else { // AssetDenomination.Par
            newPar = Types.Par({
                sign: amount.sign,
                value: amount.value.to128()
            });
            if (amount.ref == Types.AssetReference.Delta) {
                newPar = currentPar.add(newPar);
            }
            deltaWei = Interest.parToWei(newPar, state.index).sub(oldWei);
        }

        return (newPar, deltaWei);
    }

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

}
