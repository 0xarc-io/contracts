// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {ISapphirePool} from "./ISapphirePool.sol";

import {Adminable} from "../lib/Adminable.sol";
import {InitializableBaseERC20} from "../token/InitializableBaseERC20.sol";

/**
 * @notice A special AMM-like contract where swapping is permitted only by an approved
 * Sapphire Core. A portion of the interest made from the loans by the Cores is deposited
 * into this contract, and shared among the LPs.
 */
contract SapphirePool is ISapphirePool, Adminable, InitializableBaseERC20 {
    
    function init(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    ) 
        external 
        onlyAdmin 
        initializer
    {
        _init(name_, symbol_, decimals_);
        revert("Not Implemented");
    }
    
    /* ========== Restricted functions ========== */

    function approveCoreVaults(
        address _coreVault, 
        uint256 _amount
    ) 
        external
        override
        onlyAdmin
    {
        revert("Not Implemented");
    }

    function setTokenLimit(
        address _tokenAddress, 
        uint256 _limit
    ) 
        external
        override
        onlyAdmin
    {
        revert("Not Implemented");
    }

    function swap(
        address _tokenIn, 
        address _tokenOut, 
        uint256 _amountIn
    ) 
        external
        override
    {
        revert("Not Implemented");
    }

    /* ========== Public functions ========== */

    function deposit(
        address _token,
        uint256 _amount
    ) 
        external
        override
    {
        revert("Not Implemented");
    }

    function withdraw(
        address _token, 
        uint256 _amount
    ) 
        external
        override
    {
        revert("Not Implemented");
    }

    /* ========== View functions ========== */

    function getTokenUtilization(
        address _tokenAddress
    ) 
        external
        override 
        view 
        returns (uint256, uint256)
    {
        revert("Not Implemented");
    }

    function accumulatedRewardAmount(
        address _token, 
        address _user
    ) 
        external
        override 
        view 
        returns (uint256)
    {
        revert("Not Implemented");
    }
}
