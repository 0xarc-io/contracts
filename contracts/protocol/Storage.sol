pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";

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
        require(
            utilisationRatio().value <= params.maximumUtilisationRatio.value,
            "Arc: maximum utilisation ratio reached"
        );

        Decimal.D256 memory newIndex = params.interestRateModel.calculateIndex(
            utilisationRatio(),
            state.lastIndexUpdate
        );

        newIndex = Decimal.mul(
            newIndex,
            state.index
        );

        state.index = newIndex;
        state.lastIndexUpdate = block.timestamp;
    }

    function utilisationRatio()
        public
        view
        returns (Decimal.D256 memory)
    {
        if (state.borrowTotal == 0) {
            return Decimal.D256({ value: 0 });
        }

        uint256 invertedResult = state.supplyTotal.div(state.borrowTotal);
        uint256 result = Decimal.BASE.div(invertedResult);

        return Decimal.D256({ value: result });
    }

    function supplyCompounded()
        public
        view
        returns (Decimal.D256 memory)
    {

    }
}
