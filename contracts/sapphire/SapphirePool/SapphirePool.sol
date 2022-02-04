// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {ISapphirePool} from "./ISapphirePool.sol";

import {Adminable} from "../../lib/Adminable.sol";
import {InitializableBaseERC20} from "../../token/InitializableBaseERC20.sol";

/**
 * @notice A special AMM-like contract where swapping is permitted only by an approved
 * Sapphire Core. A portion of the interest made from the loans by the Cores is deposited
 * into this contract, and shared among the LPs.
 */
contract SapphirePool is ISapphirePool, Adminable, InitializableBaseERC20 {
    
    /* ========== Structs ========== */

    struct AssetUtilization {
        uint256 amountUsed;
        uint256 limit;
    }
    
    /* ========== Variables ========== */

    /**
     * @notice Determines the amount of creds the core can swap in.
     */
    mapping (address => AssetUtilization) public override coreSwapUtilization;

    /**
     * @notice Determines the amount of tokens that can be deposited by 
     * liquidity providers.
     */
    mapping (address => AssetUtilization) public override assetsUtilization;

    /**
     * @notice Stores the assets that can be deposited by LPs and swapped by cores for Creds.
     */
    address[] public supportedDepositAssets;

    /* ========== Events ========== */

    event CoreSwapLimitSet(address _core, uint256 _limit);

    event DepositLimitSet(address _asset, uint256 _limit);

    /* ========== Restricted functions ========== */

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
    }

    function setCoreSwapLimit(
        address _coreAddress, 
        uint256 _limit
    ) 
        external
        override
        onlyAdmin
    {
        coreSwapUtilization[_coreAddress].limit = _limit;

        emit CoreSwapLimitSet(_coreAddress, _limit);
    }

    /**
     * @notice Sets the limit for the deposit token. If the limit is > 0, the token is added to
     * the list of the supported deposit assets. These assets also become available for being
     * swapped by the Cores.
     */
    function setDepositLimit(
        address _tokenAddress, 
        uint256 _limit
    ) 
        external
        override
        onlyAdmin
    {
        bool isSupportedAsset = assetsUtilization[_tokenAddress].limit > 0;

        require(
            _limit > 0 || isSupportedAsset,
            "SapphirePool: the limit must be > 0 or the asset must be already supported"
        );
        
        assetsUtilization[_tokenAddress].limit = _limit;

        // Add the token to the supported assets array if limit is > 0, or remove it otherwise.
        if (_limit > 0 && !isSupportedAsset) {
            supportedDepositAssets.push(_tokenAddress);
        } else if (_limit == 0 && isSupportedAsset) {
            _rmFromDepositAssets(_tokenAddress);
        }

        emit DepositLimitSet(_tokenAddress, _limit);
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

    /**
     * @notice Returns the list of the supported assets for depositing by LPs and swapping by Cores.
     */
    function getDepositAssets() 
        external 
        view 
        override
        returns (address[] memory)
    {
        return supportedDepositAssets;
    }

    /* ========== Private functions ========== */

    function _rmFromDepositAssets(
        address _asset
    )
        private
    {
        for (uint8 i = 0; i < supportedDepositAssets.length; i++) {
            if (supportedDepositAssets[i] == _asset) {
                supportedDepositAssets[i] = supportedDepositAssets[
                    supportedDepositAssets.length - 1
                ];
                supportedDepositAssets.pop();
            }
        }
    }
}
