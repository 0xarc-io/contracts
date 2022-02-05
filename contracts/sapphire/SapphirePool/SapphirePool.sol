// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {ISapphirePool} from "./ISapphirePool.sol";

import {SafeERC20} from "../../lib/SafeERC20.sol";
import {Adminable} from "../../lib/Adminable.sol";
import {Address} from "../../lib/Address.sol";
import {IERC20Metadata} from "../../token/IERC20Metadata.sol";
import {InitializableBaseERC20} from "../../token/InitializableBaseERC20.sol";

/**
 * @notice A special AMM-like contract where swapping is permitted only by an approved
 * Sapphire Core. A portion of the interest made from the loans by the Cores is deposited
 * into this contract, and shared among the LPs.
 */
contract SapphirePool is ISapphirePool, Adminable, InitializableBaseERC20 {
    
    /* ========== Libraries ========== */

    using Address for address;
    
    /* ========== Structs ========== */

    struct AssetUtilization {
        uint256 amountUsed;
        uint256 limit;
    }
    
    /* ========== Variables ========== */

    IERC20Metadata public credsToken;

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

    mapping (address => uint8) internal _tokenDecimals;

    /* ========== Events ========== */

    event CoreSwapLimitSet(address _core, uint256 _limit);

    event DepositLimitSet(address _asset, uint256 _limit);

    event TokensDeposited(
        address _user,
        address _token,
        uint256 _depositAmount,
        uint256 _lpTokensAmount
    );

    event TokensWithdrawn(
        address _user, 
        address _token, 
        uint256 _credsAmount, 
        uint256 _withdrawAmount
    );

    /* ========== Restricted functions ========== */

    function init(
        string memory name_,
        string memory symbol_,
        address _credsToken
    ) 
        external 
        onlyAdmin 
        initializer
    {
        _init(name_, symbol_, 18);

        require (
            _credsToken.isContract(),
            "SapphirePool: Creds address is not a contract"
        );
        credsToken = IERC20Metadata(_credsToken);
    }

    /**
     * @notice Sets the limit for how many Creds can be swapped in by a Core.
     */
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
            "SapphirePool: cannot set the limit of an unsupported asset to 0"
        );
        
        assetsUtilization[_tokenAddress].limit = _limit;

        // Add the token to the supported assets array if limit is > 0
        if (_limit > 0 && !isSupportedAsset) {
            supportedDepositAssets.push(_tokenAddress);

            // Save token decimals to later compute the token scalar
            _tokenDecimals[_tokenAddress] = IERC20Metadata(_tokenAddress).decimals();
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

    /**
     * @notice Deposits the given amount of tokens into the pool. The token must be a supported
     * deposit asset.
     */
    function deposit(
        address _token,
        uint256 _amount
    ) 
        external
        override
    {
        AssetUtilization storage assetUtilization = assetsUtilization[_token];

        require(
            assetUtilization.amountUsed + _amount <= assetUtilization.limit,
            "SapphirePool: cannot deposit more than the limit"
        );

        require(
            _tokenDecimals[_token] > 0,
            "SapphirePool: the given lp token has a scalar of 0"
        );

        assetUtilization.amountUsed += _amount;

        uint256 scaledAmount = _getScaledAmount(_amount, _tokenDecimals[_token], _decimals);

        uint256 poolValue = getPoolValue();
        uint256 lpToMint;
        
        if (poolValue > 0) {
            lpToMint = scaledAmount * totalSupply() / poolValue;
        } else {
            lpToMint = scaledAmount;
        }
        
        _mint(msg.sender, lpToMint);

        SafeERC20.safeTransferFrom(
            IERC20Metadata(_token), 
            msg.sender, 
            address(this), 
            _amount
        );

        emit TokensDeposited(
            msg.sender,
            _token,
            _amount,
            lpToMint
        );
    }

    /**
     * @notice Exchanges the give amount of Creds for the equivalent amount of the given token,
     * plus the proportional rewards. The Creds exchanged are burned.
     * @param _amount The amount of Creds to exchange.
     * @param _outToken The token to exchange for.
     */
    function withdraw(
        uint256 _amount,
        address _outToken 
    ) 
        external
        override
    {
        // When we add a new supporting token, we set its decimals to this mapping.
        // So we can check with O(1) if it's a supported token by checking if its decimals are set.
        require(
            _tokenDecimals[_outToken] > 0,
            "SapphirePool: unsupported withdraw token"
        );   

        uint256 amountToWithdraw = _getScaledAmount(
            _amount,  
            _decimals,
            _tokenDecimals[_outToken]
        );

        _burn(msg.sender, _amount);

        SafeERC20.safeTransfer(
            IERC20Metadata(_outToken), 
            msg.sender, 
            amountToWithdraw
        );

        emit TokensWithdrawn(
            msg.sender, 
            _outToken, 
            _amount, 
            amountToWithdraw
        );
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
     * If an asset has a limit of 0, it will be excluded from the list.
     */
    function getDepositAssets() 
        external 
        view 
        override
        returns (address[] memory)
    {
        uint8 validAssetCount = 0;

        for (uint8 i = 0; i < supportedDepositAssets.length; i++) {
            address token = supportedDepositAssets[i];

            if (assetsUtilization[token].limit > 0) {
                validAssetCount++;
            }
        }

        address[] memory result = new address[](validAssetCount);

        for (uint8 i = 0; i < validAssetCount; i++) {
            address token = supportedDepositAssets[i];

            if (assetsUtilization[token].limit > 0) {
                result[i] = token;
            }
        }

        return result;
    }

    /**
     * @notice Returns the value of the pool in terms of the deposited stablecoins and creds.
     */
    function getPoolValue() 
        public 
        view 
        override
        returns (uint256)
    {
        uint256 result;

        for (uint8 i = 0; i < supportedDepositAssets.length; i++) {
            address token = supportedDepositAssets[i];
            uint8 decimals = _tokenDecimals[token];

            result += _getScaledAmount(
                IERC20Metadata(token).balanceOf(address(this)),
                decimals,
                18
            );
        }

        result += credsToken.balanceOf(address(this));

        return result;
    }

    /* ========== Private functions ========== */

    /**
     * @dev Used to compute the amount of LP tokens to mint 
     */
    function _getScaledAmount(
        uint256 _amount,
        uint8 _decimalsIn,
        uint8 _decimalsOut
    ) 
        internal
        pure
        returns (uint256)
    {
        if (_decimalsIn == _decimalsOut) {
            return _amount;
        }

        if (_decimalsIn > _decimalsOut) {
            return _amount / 10 ** (_decimalsIn - _decimalsOut);
        } else {
            return _amount * 10 ** (_decimalsOut - _decimalsIn);
        }
    }
}
