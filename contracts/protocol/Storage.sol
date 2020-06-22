pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Helpers} from "../lib/Helpers.sol";

import {SyntheticToken} from "../token/SyntheticToken.sol";

contract Storage {

    using SafeMath for uint256;

    // ============ Variables ============

    Types.GlobalParams public params;
    Types.State public state;

    SyntheticToken public synthetic;

    uint256 public positionCount;

    mapping (uint256 => Types.Position) public positions;
    mapping (address => Types.Balance) public supplyBalances;

    function updateIndexes()
        public
    {
        Decimal.D256 memory utilisationRatio = Helpers.utilisationRatio(
            state.borrowTotal,
            state.supplyTotal
        );

        require(
            utilisationRatio.value <= params.maximumUtilisationRatio.value,
            "Arc: maximum utilisation ratio reached"
        );

        Decimal.D256 memory newIndex = params.interestRateModel.calculateIndex(
            utilisationRatio,
            state.lastIndexUpdate
        );

        newIndex = Decimal.mul(
            newIndex,
            state.index
        );

        state.index = newIndex;
        state.lastIndexUpdate = block.timestamp;
    }
}
