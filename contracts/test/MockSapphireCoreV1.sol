// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {IOracle} from "../oracle/IOracle.sol";

import {SapphireCoreV1} from "../sapphire/SapphireCoreV1.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSapphireCoreV1 is SapphireCoreV1, MockTimestamp {

    function updateBorrowIndex(
        uint256 _borrowIndex
    )
        public
    {
        borrowIndex = _borrowIndex;
    }

    function _isOracleNotOutdated(
        uint256 _oracleTimestamp
    )
        internal
        override
        view
        returns (bool)
    {
        uint256 halfDay = 60 * 60 * 12;

        if (currentTimestamp() < halfDay) {
            return true;
        } else {
            return _oracleTimestamp >= currentTimestamp() - halfDay;
        }
    }

     function currentTimestamp()
        public
        view
        override(SapphireCoreV1, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }
}
