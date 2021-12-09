// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {StakingAccrualERC20V5} from "../../staking/StakingAccrualERC20/StakingAccrualERC20V5.sol";
import { MockTimestamp } from "../MockTimestamp.sol";

contract MockStakingAccrualERC20V5 is StakingAccrualERC20V5, MockTimestamp {

    function currentTimestamp()
        public
        view
        override(StakingAccrualERC20V5, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }

}
