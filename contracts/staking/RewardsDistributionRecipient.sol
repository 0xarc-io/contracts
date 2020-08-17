// SPDX-License-Identifier: MIT
// Copied directly from https://github.com/Synthetixio/synthetix/blob/v2.26.3/contracts/RewardsDistributionRecipient.sol

pragma solidity ^0.5.16;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";

contract RewardsDistributionRecipient is Ownable {
    address public rewardsDistribution;

    function notifyRewardAmount(uint256 reward) external;

    modifier onlyRewardsDistribution() {
        require(
            msg.sender == rewardsDistribution,
            "Caller is not RewardsDistribution contract"
        );
        _;
    }

    function setRewardsDistribution(
        address _rewardsDistribution
    )
        external
        onlyOwner
    {
        rewardsDistribution = _rewardsDistribution;
    }
}