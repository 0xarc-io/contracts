// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {JointCampaign} from "../staking/JointCampaign.sol";

contract MockJointCampaign is JointCampaign {

    uint256 private _currentTimestamp;

    constructor()
        public
        JointCampaign()
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
