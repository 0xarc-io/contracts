// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {TokenAccrual} from "./TokenAccrual.sol";

contract Distribution is Ownable, TokenAccrual {

    IERC20 public claimableToken;

    uint256 public _supply = 0;

    mapping(address => uint256) public balances;

    constructor(
        address _claimableToken
    )
        public
        TokenAccrual(_claimableToken)
    {}

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
        returns (uint256)
    {
        return totalSupply();
    }

    function getUserBalance(
        address owner
    )
        public
        view
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
        require(to != address(0), "Cannot mint to zero address");

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
        require(from != address(0), "Cannot burn to zero");

        balances[from] = balances[from].sub(value);
        _supply = _supply.sub(value);
    }

}