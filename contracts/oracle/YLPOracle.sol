// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {SafeMath} from "../lib/SafeMath.sol";

import {IOracle} from "../oracle/IOracle.sol";
import {IRiskOracle} from "../oracle/IRiskOracle.sol";

contract YLPOracle is IOracle {

    IRiskOracle public aaveRiskOracle;

    constructor()
        public
    {
        aaveRiskOracle = IRiskOracle(0x4cc91e0c97c5128247e71a5ddf01ca46f4fa8d1d);
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        return Decimal.D256({
            value: aaveRiskOracle.latestAnswer()
        });
    }
}
