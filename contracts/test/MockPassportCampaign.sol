// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import { PassportCampaign } from "../staking/PassportCampaign.sol";
import { MockTimestamp } from "./MockTimestamp.sol";

contract MockPassportCampaign is PassportCampaign, MockTimestamp {

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
