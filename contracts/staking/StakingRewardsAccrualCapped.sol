// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StakingRewards} from "./StakingRewards.sol";
import {Accrual} from "./Accrual.sol";

import {TypesV1} from "../v1/TypesV1.sol";

import {IKYFV2} from "../interfaces/IKYFV2.sol";
import {IStateV1} from "../interfaces/IStateV1.sol";

contract StakingRewardsAccrualCapped is StakingRewards, Accrual {

    /* ========== Variables ========== */

    IStateV1 public state;

    uint256 public debtRequirement;

    uint256 public debtDeadline;

    uint256 public hardCap;

    bool public tokensClaimable;

    mapping (address => bool) public kyfInstances;

    mapping (address => uint256) public stakedPosition;

    address[] public kyfInstancesArray;

    /* ========== Events ========== */

    event HardCapSet(uint256 _cap);

    event KyfStatusUpdated(address _address, bool _status);
    event PositionStaked(address _address, uint256 _positionId);

    event ClaimableStatusUpdated(bool _status);

    event UserSlashed(address _user, address _slasher, uint256 _amount);

    /* ========== Constructor ========== */

    constructor(
        address _arcDAO,
        address _rewardsDistribution,
        address _rewardsToken,
        address _stakingToken,
        address _feesToken
    )
        public
        StakingRewards(
            _arcDAO,
            _rewardsDistribution,
            _rewardsToken,
            _stakingToken
        )
        Accrual(
            _feesToken
        )
    { }

    /* ========== Public View Functions ========== */

    function getUserBalance(
        address owner
    )
        public
        view
        returns (uint256)
    {
        return balanceOf(owner);
    }

    function getTotalBalance()
        public
        view
        returns (uint256)
    {
        return totalSupply();
    }

    function getApprovedKyfInstancesArray()
        public
        view
        returns (address[] memory)
    {
        return kyfInstancesArray;
    }

    function isMinter(
        address _user,
        uint256 _positionId
    )
        public
        view
        returns (bool)
    {
        TypesV1.Position memory position = state.getPosition(_positionId);

        if (position.owner != _user) {
            return false;
        }

        return uint256(position.borrowedAmount.value) >= debtRequirement;
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

    function setDebtRequirement(
        uint256 _debtRequirement
    )
        public
        onlyOwner
    {
        debtRequirement = _debtRequirement;
    }

    function setDebtDeadline(
        uint256 _debtDeadline
    )
        public
        onlyOwner
    {
        debtDeadline = _debtDeadline;
    }

    function setStateContract(
        address _state
    )
        public
        onlyOwner
    {
        state = IStateV1(_state);
    }

    /* ========== Public Functions ========== */

    function stake(
        uint256 amount,
        uint256 positionId
    )
        external
        updateReward(msg.sender)
    {
        uint256 totalBalance = balanceOf(msg.sender).add(amount);

        require(
            totalBalance <= hardCap,
            "Cannot stake more than the hard cap"
        );

        require(
            isVerified(msg.sender) == true,
            "Must be KYF registered to participate"
        );

        require(
            isMinter(msg.sender, positionId),
            "Must be a valid minter"
        );

        stakedPosition[msg.sender] = positionId;

        _stake(amount);

        emit PositionStaked(msg.sender, positionId);
    }

    function slash(
        address user
    )
        external
        updateReward(user)
    {
        require(
            user != msg.sender,
            "You cannot slash yourself"
        );

        require(
            isVerified(msg.sender) == true,
            "Must be KYF registered to participate"
        );

        require(
            block.timestamp < debtDeadline,
            "You cannot slash after the debt deadline"
        );

        require(
            isMinter(
                user,
                stakedPosition[user]
            ) == false,
            "You cant slash a user who has staked"
        );

        require(
            isMinter(
                msg.sender,
                stakedPosition[msg.sender]
            ) == true,
            "You must be a minter in order to slash"
        );

        uint256 reward = rewards[user];

        rewards[msg.sender] = rewards[msg.sender].add(reward);
        rewards[user] = 0;

        emit UserSlashed(user, msg.sender, reward);
    }

    function getReward(address user)
        public
        updateReward(user)
    {
        require(
            tokensClaimable == true,
            "Tokens cannnot be claimed yet"
        );

        _getReward(user);
    }

    function withdraw(
        uint256 amount
    )
        public
        updateReward(msg.sender)
    {
        _withdraw(amount);
    }

    function exit()
        external
        updateReward(msg.sender)
    {
        getReward(msg.sender);
        withdraw(balanceOf(msg.sender));
    }

}