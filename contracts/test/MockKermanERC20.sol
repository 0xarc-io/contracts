// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import { KermanRewards } from "../staking/KermanRewards.sol";
import { MockTimestamp } from "./MockTimestamp.sol";

contract MockKermanRewards is KermanRewards, MockTimestamp {

    function currentTimestamp()
        public
        view
        override(KermanRewards, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }

}
