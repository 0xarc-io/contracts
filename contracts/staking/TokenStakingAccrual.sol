// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import {IERC20} from "../token/IERC20.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";

import {Accrual} from "./Accrual.sol";

contract TokenStakingAccrual is Accrual {

    using SafeERC20 for IERC20;

    IERC20 public stakingToken;

    mapping (address => uint256) public stakedBalance;

    uint256 public stakedTotal;

    event Staked(address owner, uint256 amount);
    event Unstaked(address owner, uint256 amount);

    constructor(
        address _stakingToken,
        address _earningToken
    )
        public
        Accrual(
            _earningToken
        )
    {
        stakingToken = IERC20(_stakingToken);
    }

    function getUserBalance(
        address owner
    )
        public
        view
        returns (uint256)
    {
        return stakedBalance[owner];
    }

    function getTotalBalance()
        public
        view
        returns (uint256)
    {
        return stakedTotal;
    }

    function stake(
        uint256 amount
    )
        public
    {
        stakedBalance[msg.sender] = stakedBalance[msg.sender].add(amount);
        stakedTotal = stakedTotal.add(amount);

        stakingToken.safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );

        emit Staked(msg.sender, amount);
    }

    function unstake(
        uint256 amount
    )
        public
    {
        stakedBalance[msg.sender] = stakedBalance[msg.sender].sub(amount);
        stakedTotal = stakedTotal.sub(amount);

        stakingToken.safeTransfer(
            msg.sender,
            amount
        );

        emit Unstaked(msg.sender, amount);
    }

}
