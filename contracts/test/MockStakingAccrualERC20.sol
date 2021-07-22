// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {StakingAccrualERC20} from "../staking/StakingAccrualERC20.sol";
import { MockTimestamp } from "./MockTimestamp.sol";

contract MockStakingAccrualERC20 is StakingAccrualERC20, MockTimestamp {/* solium-disable-line no-empty-blocks */}
