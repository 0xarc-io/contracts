// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {StakingAccrualERC20} from "../../staking/StakingAccrualERC20/StakingAccrualERC20.sol";
import { MockTimestamp } from "../MockTimestamp.sol";

contract MockStakingAccrualERC20 is StakingAccrualERC20, MockTimestamp {

    function currentTimestamp()
        public
        view
        override(StakingAccrualERC20, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }

}
