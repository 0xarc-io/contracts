pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Helpers} from "../lib/Helpers.sol";
import {Interest} from "../lib/Interest.sol";
import {Math} from "../lib/Math.sol";

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

}
