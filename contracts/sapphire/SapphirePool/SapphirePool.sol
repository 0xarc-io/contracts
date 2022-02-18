// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {ISapphirePool} from "./ISapphirePool.sol";

import {SafeERC20} from "../../lib/SafeERC20.sol";
import {Adminable} from "../../lib/Adminable.sol";
import {Address} from "../../lib/Address.sol";
import {Math} from "../../lib/Math.sol";
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

    // Used in _getWithdrawAmounts to get around the stack too deep error.
    struct WithdrawAmountInfo {
        uint256 poolValue;
        uint256 totalSupply;
        uint256 withdrawAmt;
        uint256 scaledWithdrawAmt;
        uint256 userDeposit;
        uint256 assetUtilization;
        uint256 scaledAssetUtilization;
    }

    /* ========== Variables ========== */

    IERC20Metadata public credsToken;

    /**
     * @notice Determines the amount of creds the core can swap in. The amounts are stored in
     * 18 decimals.
     */
    mapping (address => AssetUtilization) public override coreSwapUtilization;

    /**
     * @notice Determines the amount of tokens that can be deposited by
     * liquidity providers. The amounts are stored in the asset's native decimals.
     */
    mapping (address => AssetUtilization) public override assetDepositUtilization;

    /**
     * @notice Determines the amount of tokens deposited by liquidity providers. Stored in 18
     * decimals.
     */
    mapping (address => uint256) public override deposits;

    /**
     * @dev Stores the assets that have been historically allowed to be deposited.
     */
    address[] internal _knownDepositAssets;

    /**
     * @dev Stores the cores that have historically been approved to swap in assets.
     */
    address[] internal _knownCores;

    mapping (address => uint8) internal _tokenDecimals;

    /* ========== Events ========== */

    event CoreSwapLimitSet(address _core, uint256 _limit);

    event DepositLimitSet(address _asset, uint256 _limit);

    event TokensDeposited(
        address indexed _user,
        address indexed _token,
        uint256 _depositAmount,
        uint256 _lpTokensAmount
    );

    event TokensWithdrawn(
        address indexed _user,
        address indexed _token,
        uint256 _credsAmount,
        uint256 _withdrawAmount
    );

    event TokensSwapped(
        address indexed _core,
        address _tokenIn,
        address indexed _tokenOut,
        uint256 _amountIn,
        uint256 _amountOut,
        address indexed _receiver
    );

    /* ========== Modifiers ========== */

    modifier checkKnownToken (address _token) {
        require(
            _isKnownToken(_token),
            "SapphirePool: unknown token"
        );
        _;
    }

    /* ========== Restricted functions ========== */

    function init(
        string memory _name,
        string memory _symbol,
        address _credsToken
    )
        external
        onlyAdmin
        initializer
    {
        _init(_name, _symbol, 18);

        require (
            _credsToken.isContract(),
            "SapphirePool: Creds address is not a contract"
        );
        credsToken = IERC20Metadata(_credsToken);
    }

    /**
     * @notice Sets the limit for how many Creds can be swapped in by a Core.
     * The sum of the core limits cannot be greater than the sum of the deposit limits.
     */
    function setCoreSwapLimit(
        address _coreAddress,
        uint256 _limit
    )
        external
        override
        onlyAdmin
    {
        (
            uint256 sumOfDepositLimits,
            uint256 sumOfCoreLimits,
            bool isCoreKnown
        ) = _getSumOfLimits(_coreAddress, _coreAddress, address(0));

        require(
            sumOfCoreLimits + _limit <= sumOfDepositLimits,
            "SapphirePool: swap limit is greater than the sum of the deposit limits"
        );

        require(
            sumOfCoreLimits + _limit > 0,
            "SapphirePool: at least one asset must have a positive swap limit"
        );

        if (!isCoreKnown) {
            _knownCores.push(_coreAddress);
        }

        coreSwapUtilization[_coreAddress].limit = _limit;

        emit CoreSwapLimitSet(_coreAddress, _limit);
    }

    /**
     * @notice Sets the limit for the deposit token. If the limit is > 0, the token is added to
     * the list of the known deposit assets. These assets also become available for being
     * swapped by the Cores, unless their limit is set to 0 later on.
     * The sum of the deposit limits cannot be smaller than the sum of the core limits.
     * @param _tokenAddress The address of the deposit token.
     * @param _limit The limit for the deposit token, in its own native decimals.
     */
    function setDepositLimit(
        address _tokenAddress,
        uint256 _limit
    )
        external
        override
        onlyAdmin
    {
        bool isKnownToken = _isKnownToken(_tokenAddress);

        require(
            _limit > 0 || isKnownToken,
            "SapphirePool: cannot set the limit of an unknown asset to 0"
        );

        (
            uint256 sumOfDepositLimits,
            uint256 sumOfCoreLimits,
        ) = _getSumOfLimits(address(0), address(0), _tokenAddress);

        // Add the token to the known assets array if limit is > 0
        if (_limit > 0 && !isKnownToken) {
            _knownDepositAssets.push(_tokenAddress);

            // Save token decimals to later compute the token scalar
            _tokenDecimals[_tokenAddress] = IERC20Metadata(_tokenAddress).decimals();
        }

        uint256 scaledNewLimit = _getScaledAmount(
            _limit,
            _tokenDecimals[_tokenAddress],
            _decimals
        );

        // The new sum of deposit limits cannot be zero, otherwise the pool will become
        // unusable (deposits will be disabled).
        require(
            sumOfDepositLimits + scaledNewLimit > 0,
            "SapphirePool: at least 1 deposit asset must have a positive limit"
        );

        require(
            sumOfDepositLimits + scaledNewLimit >= sumOfCoreLimits,
            "SapphirePool: sum of deposit limits smaller than the sum of the swap limits"
        );

        assetDepositUtilization[_tokenAddress].limit = _limit;

        emit DepositLimitSet(_tokenAddress, _limit);
    }

    /**
     * @notice Performs a swap between the specified tokens, for the given amount. Assumes
     * a 1:1 conversion. Only approved cores have permission to swap.
     */
    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        address _receiver
    )
        external
        override
    {
        uint256 amountOut;

        require(
            coreSwapUtilization[msg.sender].limit > 0,
            "SapphirePool: caller should be a core with a positive swap limit"
        );

        require(
            _tokenIn != _tokenOut && (
                _tokenIn == address(credsToken) ||
                _tokenOut == address(credsToken)
            ),
            "SapphirePool: invalid swap tokens"
        );

        if (_tokenIn == address(credsToken)) {
            amountOut = _swapCredsForStables(
                _tokenOut,
                _amountIn,
                _receiver
            );
        } else {
            amountOut = _swapStablesForCreds(
                _tokenIn,
                _amountIn,
                _receiver
            );
        }

        emit TokensSwapped(
            msg.sender,
            _tokenIn,
            _tokenOut,
            _amountIn,
            amountOut,
            _receiver
        );
    }

    /* ========== Public functions ========== */

    /**
     * @notice Deposits the given amount of tokens into the pool.
     * The token must have a deposit limit > 0.
     */
    function deposit(
        address _token,
        uint256 _amount
    )
        external
        override
    {
        AssetUtilization storage utilization = assetDepositUtilization[_token];

        require(
            utilization.amountUsed + _amount <= utilization.limit,
            "SapphirePool: cannot deposit more than the limit"
        );

        uint256 scaledAmount = _getScaledAmount(
            _amount,
            _tokenDecimals[_token],
            _decimals
        );
        uint256 poolValue = getPoolValue();

        uint256 lpToMint;
        if (poolValue > 0) {
            lpToMint = Math.roundUpDiv(
                scaledAmount * totalSupply() / 10 ** _decimals,
                poolValue
            );
        } else {
            lpToMint = scaledAmount;
        }

        utilization.amountUsed += _amount;
        deposits[msg.sender] += scaledAmount;

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
     * @notice Exchanges the given amount of Creds for the equivalent amount of the given token,
     * plus the proportional rewards. The Creds exchanged are burned.
     * @param _lpAmount The amount of Creds to exchange.
     * @param _withdrawToken The token to exchange for.
     */
    function withdraw(
        uint256 _lpAmount,
        address _withdrawToken
    )
        external
        override
        checkKnownToken(_withdrawToken)
    {
        (
            uint256 assetUtilizationReduceAmt,
            uint256 userDepositReduceAmt,
            uint256 scaledWithdrawAmt
        ) = _getWithdrawAmounts(_lpAmount, _withdrawToken);

        assetDepositUtilization[_withdrawToken].amountUsed -= assetUtilizationReduceAmt;
        deposits[msg.sender] -= userDepositReduceAmt;

        _burn(msg.sender, _lpAmount);

        SafeERC20.safeTransfer(
            IERC20Metadata(_withdrawToken),
            msg.sender,
            scaledWithdrawAmt
        );

        emit TokensWithdrawn(
            msg.sender,
            _withdrawToken,
            _lpAmount,
            scaledWithdrawAmt
        );
    }

    /* ========== View functions ========== */

    /**
     * @notice Returns the rewards accumulated into the pool
     */
    function accumulatedRewardAmount()
        external
        override
        view
        returns (uint256)
    {
        uint256 poolValue = getPoolValue();

        uint256 depositValue;

        for (uint8 i = 0; i < _knownDepositAssets.length; i++) {
            address token = _knownDepositAssets[i];
            depositValue += _getScaledAmount(
                assetDepositUtilization[token].amountUsed,
                _tokenDecimals[token],
                18
            );
        }

        return poolValue - depositValue;
    }

    /**
     * @notice Returns the list of the available deposit and swap assets.
     * If an asset has a limit of 0, it will be excluded from the list.
     */
    function getDepositAssets()
        external
        view
        override
        returns (address[] memory)
    {
        uint8 validAssetCount = 0;

        for (uint8 i = 0; i < _knownDepositAssets.length; i++) {
            address token = _knownDepositAssets[i];

            if (assetDepositUtilization[token].limit > 0) {
                validAssetCount++;
            }
        }

        address[] memory result = new address[](validAssetCount);

        uint8 currentIndex = 0;
        for (uint8 i = 0; i < _knownDepositAssets.length; i++) {
            address token = _knownDepositAssets[i];

            if (assetDepositUtilization[token].limit > 0) {
                result[currentIndex] = token;
                currentIndex++;
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

        for (uint8 i = 0; i < _knownDepositAssets.length; i++) {
            address token = _knownDepositAssets[i];
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

    function _swapCredsForStables(
        address _tokenOut,
        uint256 _credsAmount,
        address _receiver
    )
        private
        checkKnownToken(_tokenOut)
        returns (uint256)
    {
        AssetUtilization storage utilization = coreSwapUtilization[msg.sender];

        require(
            utilization.amountUsed + _credsAmount <= utilization.limit,
            "SapphirePool: core swap limit exceeded"
        );

        uint256 expectedOutAmount = _getScaledAmount(
            _credsAmount,
            _decimals,
            _tokenDecimals[_tokenOut]
        );

        // Increase core utilization
        utilization.amountUsed += _credsAmount;

        SafeERC20.safeTransferFrom(
            IERC20Metadata(credsToken),
            msg.sender,
            address(this),
            _credsAmount
        );

        SafeERC20.safeTransfer(
            IERC20Metadata(_tokenOut),
            _receiver,
            expectedOutAmount
        );

        return expectedOutAmount;
    }

    function _swapStablesForCreds(
        address _tokenIn,
        uint256 _stablesAmount,
        address _receiver
    )
        private
        checkKnownToken(_tokenIn)
        returns (uint256)
    {
        require(
            assetDepositUtilization[_tokenIn].limit > 0,
            "SapphirePool: cannot repay with the given token"
        );

        uint8 stableDecimals = _tokenDecimals[_tokenIn];
        uint256 credsOutAmount = _getScaledAmount(
            _stablesAmount,
            stableDecimals,
            _decimals
        );
        AssetUtilization storage utilization = coreSwapUtilization[msg.sender];

        utilization.amountUsed -= credsOutAmount;

        SafeERC20.safeTransferFrom(
            IERC20Metadata(_tokenIn),
            msg.sender,
            address(this),
            _stablesAmount
        );

        SafeERC20.safeTransfer(
            IERC20Metadata(credsToken),
            _receiver,
            credsOutAmount
        );

        return credsOutAmount;
    }

    /**
     * @dev Returns the sum of the deposit limits and the sum of the core swap limits
     * @param _optionalCoreCheck An optional parameter to check if the core has a swap limit > 0
     * @param _excludeCore An optional parameter to exclude the core from the sum
     * @param _excludeDepositToken An optional parameter to exclude the deposit token from the sum
     */
    function _getSumOfLimits(
        address _optionalCoreCheck,
        address _excludeCore,
        address _excludeDepositToken
    )
        private
        view
        returns (uint256, uint256, bool)
    {
        uint256 sumOfDepositLimits;
        uint256 sumOfCoreLimits;
        bool isCoreKnown;
        uint8 decimals;

        for (uint8 i = 0; i < _knownDepositAssets.length; i++) {
            address token = _knownDepositAssets[i];
            if (token == _excludeDepositToken) {
                continue;
            }

            decimals = _tokenDecimals[token];

            sumOfDepositLimits += _getScaledAmount(
                assetDepositUtilization[token].limit,
                decimals,
                18
            );
        }

        for (uint8 i = 0; i < _knownCores.length; i++) {
            address core = _knownCores[i];
            if (core == _excludeCore) {
                continue;
            }

            sumOfCoreLimits += coreSwapUtilization[core].limit;

            if (core == _optionalCoreCheck) {
                isCoreKnown = true;
            }
        }

        return (
            sumOfDepositLimits,
            sumOfCoreLimits,
            isCoreKnown
        );
    }

    /**
     * @dev Returns the amount to be reduced from the user's deposit mapping, token deposit
     * usage and the amount of tokens to be withdrawn, in the withdraw token decimals.
     */
    function _getWithdrawAmounts(
        uint256 _lpAmount,
        address _withdrawToken
    )
        private
        view
        returns (uint256, uint256, uint256)
    {
        WithdrawAmountInfo memory info = _getWithdrawAmountsVars(_lpAmount, _withdrawToken);

        if (info.userDeposit > 0) {
            // User didn't withdraw their initial deposit yet
            if (info.userDeposit > info.withdrawAmt) {
                // Reduce the user's deposit amount and the asset utilization
                // by the amount withdrawn
                return (
                    info.scaledWithdrawAmt,
                    info.withdrawAmt,
                    info.scaledWithdrawAmt
                );
            }

            // The withdraw amount is bigger than the user's initial deposit. This happens when the
            // rewards claimable by the user are greater than the amount of tokens they have
            // deposited.
            if (info.assetUtilization > info.userDeposit) {
                // There's more asset utilization than the user's initial deposit. Reduce it by
                // the amount of the user's initial deposit.
                return (
                    _getScaledAmount(
                        info.userDeposit,
                        _decimals,
                        _tokenDecimals[_withdrawToken]
                    ),
                    info.userDeposit,
                    info.scaledWithdrawAmt
                );
            }

            // The asset utilization is smaller or equal to the user's initial deposit.
            // Set both to 0. The asset utilization can be smaller than the user's initial deposit
            // in the scenario when the user deposited in one token, and withdraws in another.
            return (
                info.assetUtilization,
                info.userDeposit,
                info.scaledWithdrawAmt
            );
        }

        // User deposit is 0, meaning they have withdrawn their initial deposit, and now they're
        // withdrawing pure profit.
        return (
            0,
            0,
            info.scaledWithdrawAmt
        );
    }

    function _getWithdrawAmountsVars(
        uint256 _amount,
        address _withdrawToken
    )
        private
        view
        returns (WithdrawAmountInfo memory)
    {
        WithdrawAmountInfo memory info;

        info.poolValue = getPoolValue();
        info.totalSupply = totalSupply();

        info.withdrawAmt = _amount * info.poolValue / info.totalSupply;
        info.scaledWithdrawAmt = _getScaledAmount(
            info.withdrawAmt,
            _decimals,
            _tokenDecimals[_withdrawToken]
        );

        info.userDeposit = deposits[msg.sender];
        info.assetUtilization = assetDepositUtilization[_withdrawToken].amountUsed;
        info.scaledAssetUtilization = _getScaledAmount(
            info.assetUtilization,
            _tokenDecimals[_withdrawToken],
            _decimals
        );

        return info;
    }

    /**
     * @dev Returns true if the token was historically added as a deposit token
     */
    function _isKnownToken(
        address _token
    )
        private
        view
        returns (bool)
    {
        return _tokenDecimals[_token] > 0;
    }
}
