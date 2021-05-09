// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { LiquidityCampaignV2 } from "../staking/LiquidityCampaignV2.sol";
import { MockTimestamp } from "./MockTimestamp.sol";

contract MockLiquidityCampaignV2 is LiquidityCampaignV2, MockTimestamp {

    function actualEarned(
        address _account
    )
        public
        view
        returns (uint256)
    {
        return _actualEarned(_account);
    }

}
