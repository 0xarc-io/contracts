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
        aaveRiskOracle = IRiskOracle(0x4CC91E0c97c5128247E71a5DdF01CA46f4fa8d1d);
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        // It's safe to typecast here since Aave's risk oracle has a backup oracles
        // if the price drops below $0 in the original signed int.
        return Decimal.D256({
            value: uint256(aaveRiskOracle.latestAnswer())
        });
    }
}
