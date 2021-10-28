// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {Sablier} from "../global/Sablier.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSablier is Sablier, MockTimestamp {

    function currentTimestamp()
        public
        view
        override(Sablier, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }

}
