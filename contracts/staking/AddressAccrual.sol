// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {Ownable} from "../lib/Ownable.sol";
import {SafeMath} from "../lib/SafeMath.sol";

import {IERC20} from "../token/IERC20.sol";

import {Accrual} from "./Accrual.sol";

contract AddressAccrual is Ownable, Accrual {

    using SafeMath for uint256;

    uint256 public _supply = 0;

    mapping(address => uint256) public balances;

    constructor(
        address _claimableToken
    )
        Accrual(_claimableToken)
    {} // solhint-disable-line

    function totalSupply()
        public
        view
        returns (uint256)
    {
        return _supply;
    }

    function balanceOf(
        address account
    )
        public
        view
        returns (uint256)
    {
        return balances[account];
    }

    function getTotalBalance()
        public
        view
        override
        returns (uint256)
    {
        return totalSupply();
    }

    function getUserBalance(
        address owner
    )
        public
        view
        override
        returns (uint256)
    {
        return balanceOf(owner);
    }

    function increaseShare(
        address to,
        uint256 value
    )
        public
        onlyOwner
    {
        require(to != address(0), "Cannot add zero address");

        balances[to] = balances[to].add(value);
        _supply = _supply.add(value);
    }

    function decreaseShare(
        address from,
        uint256 value
    )
        public
        onlyOwner
    {
        require(from != address(0), "Cannot remove zero address");

        balances[from] = balances[from].sub(value);
        _supply = _supply.sub(value);
    }

}
