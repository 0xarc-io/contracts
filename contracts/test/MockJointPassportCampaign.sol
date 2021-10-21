// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {JointPassportCampaign} from "../staking/JointPassportCampaign.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockJointPassportCampaign is JointPassportCampaign, MockTimestamp {

    constructor(
        address _arcDAO,
        address _arcRewardsDistributor,
        address _collabRewardsDistributor,
        address _arcRewardToken,
        address _collabRewardToken,
        address _stakingToken,
        address _creditScoreContract,
        uint256 _daoAllocation,
        uint256 _maxStakePerUser,
        uint16 _creditScoreThreshold
    )
        public
        JointPassportCampaign (
            _arcDAO,
            _arcRewardsDistributor,
            _collabRewardsDistributor,
            _arcRewardToken,
            _collabRewardToken,
            _stakingToken,
            _creditScoreContract,
            _daoAllocation,
            _maxStakePerUser,
            _creditScoreThreshold
        )
    { }

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
