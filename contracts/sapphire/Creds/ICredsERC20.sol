// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IERC20} from "../../token/IERC20.sol";

interface ICredsERC20 is IERC20 {
    function addMinter(address _minter, uint256 _limit) external;

    function removeMinter(address _minter) external;

    function updateMinterLimit(address _minter, uint256 _limit) external;

    function mint(address _to, uint256 _value) external;

    function burn(uint256 _value) external;
}
