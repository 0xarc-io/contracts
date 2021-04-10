// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {JointCampaignV2} from "../staking/JointCampaignV2.sol";

contract MockJointCampaignV2 is JointCampaignV2 {

    uint256 private _currentTimestamp;

    constructor()
        public
        JointCampaignV2()
    { }

    function setCurrentTimestamp(
        uint256 _timestamp
    )
        public
    {
        _currentTimestamp = _timestamp;
    }

    function getCurrentTimestamp()
        public
        view
        returns (uint256)
    {
        return _currentTimestamp;
    }

    function actualEarned(
        address _account,
        address _rewardToken
    )
        public
        view
        verifyRewardToken(_rewardToken)
        returns (uint256)
    {
        return _actualEarned(_account, _rewardToken);
    }
}
