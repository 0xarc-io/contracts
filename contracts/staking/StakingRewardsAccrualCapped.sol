// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StakingRewardsAccrual} from "./StakingRewardsAccrual.sol";

import {IKYFV2} from "../interfaces/IKYFV2.sol";

contract StakingRewardsAccrualCapped is StakingRewardsAccrual {

    /* ========== Variables ========== */

    uint256 public hardCap;

    bool public tokensClaimable;

    mapping (address => bool) public kyfInstances;

    address[] public kyfInstancesArray;

    /* ========== Events ========== */

    event HardCapSet(uint256 _cap);

    event KyfStatusUpdated(address _address, bool _status);

    event ClaimableStatusUpdated(bool _status);

    /* ========== Constructor ========== */

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
        StakingRewardsAccrual(
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken,
            _feesToken
        )
    {

    }

    /* ========== Public View Functions ========== */

    function getApprovedKyfInstancesArray()
        public
        view
        returns (address[] memory)
    {
        return kyfInstancesArray;
    }

    function isVerified(
        address _user
    )
        public
        view
        returns (bool)
    {
        for (uint256 i = 0; i < kyfInstancesArray.length; i++) {
            IKYFV2 kyfContract = IKYFV2(kyfInstancesArray[i]);
            if (kyfContract.checkVerified(_user) == true) {
                return true;
            }
        }

        return false;
    }

    /* ========== Admin Functions ========== */

    function setStakeHardCap(
        uint256 _hardCap
    )
        public
        onlyOwner
    {
        hardCap = _hardCap;

        emit HardCapSet(_hardCap);
    }

    function setTokensClaimable(
        bool _enabled
    )
        public
        onlyOwner
    {
        tokensClaimable = _enabled;

        emit ClaimableStatusUpdated(_enabled);
    }

    function setApprovedKYFInstance(
        address _kyfContract,
        bool _status
    )
        public
        onlyOwner
    {
        if (_status == true) {
            kyfInstancesArray.push(_kyfContract);
            kyfInstances[_kyfContract] = true;
            emit KyfStatusUpdated(_kyfContract, true);
            return;
        }

        // Remove the kyfContract from the kyfInstancesArray array.
        for (uint i = 0; i < kyfInstancesArray.length; i++) {
            if (address(kyfInstancesArray[i]) == _kyfContract) {
                delete kyfInstancesArray[i];
                kyfInstancesArray[i] = kyfInstancesArray[kyfInstancesArray.length - 1];

                // Decrease the size of the array by one.
                kyfInstancesArray.length--;
                break;
            }
        }

        // And remove it from the synths mapping
        delete kyfInstances[_kyfContract];
        emit KyfStatusUpdated(_kyfContract, false);
    }

    /* ========== Public Functions ========== */

    function stake(
        uint256 _amount
    )
        public
        updateReward(msg.sender)
    {
        uint256 totalBalance = balanceOf(msg.sender).add(_amount);

        require(
            totalBalance <= hardCap,
            "Cannot stake more than the hard cap"
        );

        require(
            isVerified(msg.sender) == true,
            "Must be KYF registered to participate"
        );

        super.stake(_amount);
    }

    function getReward()
        public
        updateReward(msg.sender)
    {
        require(
            tokensClaimable == true,
            "Tokens cannnot be claimed yet"
        );

        super.getReward();
    }

}