// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {StakingAccrualERC20V4} from "../../staking/StakingAccrualERC20/StakingAccrualERC20V4.sol";
import { MockTimestamp } from "../MockTimestamp.sol";

contract MockStakingAccrualERC20V4 is StakingAccrualERC20V4, MockTimestamp {

    function currentTimestamp()
        public
        view
        override(StakingAccrualERC20V4, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }

}
