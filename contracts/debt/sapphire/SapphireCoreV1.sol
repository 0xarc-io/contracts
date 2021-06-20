// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {BaseERC20} from "../../token/BaseERC20.sol";
import {IERC20} from "../../token/IERC20.sol";
import {IERC20Metadata} from "../../token/IERC20Metadata.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {SafeMath} from "../../lib/SafeMath.sol";
import {Math} from "../../lib/Math.sol";
import {Adminable} from "../../lib/Adminable.sol";
import {Address} from "../../lib/Address.sol";
import {ISapphireOracle} from "../../oracle/ISapphireOracle.sol";
import {ISyntheticTokenV2} from "../../token/ISyntheticTokenV2.sol";

import {SapphireTypes} from "./SapphireTypes.sol";
import {SapphireCoreStorage} from "./SapphireCoreStorage.sol";
import {SapphireAssessor} from "./SapphireAssessor.sol";
import {ISapphireAssessor} from "./ISapphireAssessor.sol";

contract SapphireCoreV1 is SapphireCoreStorage, Adminable {

    /* ========== Libraries ========== */

    using SafeMath for uint256;
    using Address for address;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Events ========== */

    event ActionsOperated(
        SapphireTypes.Action[] _actions,
        SapphireTypes.ScoreProof _scoreProof,
        address indexed _user
    );

    event LiquidationFeesUpdated(
        uint256 _liquidationUserRatio,
        uint256 _liquidationArcRatio
    );

    event LimitsUpdated(
        uint256 _totalBorrowLimit,
        uint256 _vaultBorrowMinimum,
        uint256 _vaultBorrowMaximum
    );

    event IndexUpdated(
        uint256 _newIndex,
        uint256 _lastUpdateTime
    );

    event InterestRateUpdated(uint256 _value);

    event OracleUpdated(address _oracle);

    event PauseStatusUpdated(bool _pauseStatus);

    event InterestSetterUpdated(address _newInterestSetter);

    event PauseOperatorUpdated(address _newPauseOperator);

    event AssessorUpdated(address _newAssessor);

    event CollateralRatiosUpdated(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    );

    event FeeCollectorUpdated(
        address _feeCollector
    );

    event TokensWithdrawn(
        address indexed _token,
        address _destination,
        uint256 _amount
    );

    /* ========== Admin Setters ========== */

    /**
     * @dev Initialize the protocol with the appropriate parameters. Can only be called once.
     *      IMPORTANT: the contract assumes the collateral contract is to be trusted.
     *      Make sure this is true before calling this function.
     *
     * @param _collateralAddress    The address of the collateral to be used
     * @param _syntheticAddress     The address of the synthetic token proxy
     * @param _oracleAddress        The address of the IOracle conforming contract
     * @param _interestSetter       The address which can update interest rates
     * @param _pauseOperator        The address which can pause the contract
     * @param _assessorAddress,     The address of assessor contract conforming ISapphireAssessor,
     *                              which provides credit score functionality
     * @param _feeCollector         The address of the ARC fee collector when a liquidation occurs
     * @param _highCollateralRatio  High limit of how much collateral is needed to borrow
     * @param _lowCollateralRatio   Low limit of how much collateral is needed to borrow
     * @param _liquidationUserRatio   How much is a user penalized if they go below their c-ratio
     * @param _liquidationArcRatio    How much of the liquidation profit should ARC take
     */
    function init(
        address _collateralAddress,
        address _syntheticAddress,
        address _oracleAddress,
        address _interestSetter,
        address _pauseOperator,
        address _assessorAddress,
        address _feeCollector,
        uint256 _highCollateralRatio,
        uint256 _lowCollateralRatio,
        uint256 _liquidationUserRatio,
        uint256 _liquidationArcRatio
    )
        external
        onlyAdmin
    {
        require(
            collateralAsset == address(0),
            "SapphireCoreV1: cannot re-initialize contract"
        );

        require(
            _collateralAddress != address(0),
            "SapphireCoreV1: collateral is required"
        );

        require(
            _syntheticAddress != address(0),
            "SapphireCoreV1: synthetic is required"
        );

        require(
            _collateralAddress.isContract() &&
            _syntheticAddress.isContract(),
            "SapphireCoreV1: collateral or synthetic are not contracts"
        );

        paused = true;
        borrowIndex = BASE;
        indexLastUpdate = currentTimestamp();
        collateralAsset = _collateralAddress;
        syntheticAsset = _syntheticAddress;
        interestSetter = _interestSetter;
        pauseOperator = _pauseOperator;
        feeCollector = _feeCollector;

        IERC20Metadata collateral = IERC20Metadata(collateralAsset);
        uint8 collateralDecimals = collateral.decimals();

        require(
            collateralDecimals <= 18,
            "SapphireCoreV1: collateral has more than 18 decimals"
        );

        precisionScalar = 10 ** (18 - uint256(collateralDecimals));

        setAssessor(_assessorAddress);
        setOracle(_oracleAddress);
        setCollateralRatios(_lowCollateralRatio, _highCollateralRatio);
        _setFees(_liquidationUserRatio, _liquidationArcRatio);
    }

    /**
     * @dev Set the instance of the oracle to report prices from. Must conform to IOracle.sol
     *
     * @notice Can only be called by the admin
     *
     * @param _oracleAddress The address of the IOracle instance
     */
    function setOracle(
        address _oracleAddress
    )
        public
        onlyAdmin
    {
        require(
            _oracleAddress.isContract(),
            "SapphireCoreV1: oracle is not a contract"
        );

        require(
            _oracleAddress != address(oracle),
            "SapphireCoreV1: the same oracle is already set"
        );

        oracle = ISapphireOracle(_oracleAddress);
        emit OracleUpdated(_oracleAddress);
    }

    /**
     * @dev Set low and high collateral ratios of collateral value to debt.
     *
     * @notice Can only be called by the admin.
     *
     * @param _lowCollateralRatio The minimal allowed ratio expressed up to 18 decimal places
     * @param _highCollateralRatio The maximum allowed ratio expressed up to 18 decimal places
     */
    function setCollateralRatios(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    )
        public
        onlyAdmin
    {
        require(
            _lowCollateralRatio <= _highCollateralRatio,
            "SapphireCoreV1: high c-ratio is lower than the low c-ratio"
        );

        require(
            _lowCollateralRatio >= BASE,
            "SapphireCoreV1: collateral ratio has to be at least 1"
        );

        require(
            (_lowCollateralRatio != lowCollateralRatio) ||
            (_highCollateralRatio != highCollateralRatio),
            "SapphireCoreV1: the same ratios are already set"
        );

        lowCollateralRatio = _lowCollateralRatio;
        highCollateralRatio = _highCollateralRatio;

        emit CollateralRatiosUpdated(lowCollateralRatio, highCollateralRatio);
    }

    /**
     * @dev Set the fees in the system.
     *
     * @notice Can only be called by the admin.
     *
     * @param _liquidationUserRatio   Determines the penalty a user must pay by discounting
     *                              their collateral price to provide a profit incentive for liquidators
     * @param _liquidationArcRatio    The percentage of the profit earned from the liquidation, which feeCollector earns.
     */
    function setFees(
        uint256 _liquidationUserRatio,
        uint256 _liquidationArcRatio
    )
        public
        onlyAdmin
    {
        require(
            (_liquidationUserRatio != liquidationUserRatio) ||
            (_liquidationArcRatio != liquidationArcRatio),
            "SapphireCoreV1: the same fees are already set"
        );

        _setFees(_liquidationUserRatio, _liquidationArcRatio);
    }

    /**
     * @dev Set the limits of the system to ensure value can be capped.
     *
     * @notice Can only be called by the admin
     *
     * @param _totalBorrowLimit   Maximum amount of borrowed amount that can be held in the system.
     * @param _vaultBorrowMinimum The minimum allowed borrow amount for vault
     * @param _vaultBorrowMaximum The maximum allowed borrow amount for vault
     */
    function setLimits(
        uint256 _totalBorrowLimit,
        uint256 _vaultBorrowMinimum,
        uint256 _vaultBorrowMaximum
    )
        public
        onlyAdmin
    {
        require(
            _vaultBorrowMinimum <= _vaultBorrowMaximum &&
            _vaultBorrowMaximum <= _totalBorrowLimit,
            "SapphireCoreV1: required condition is vaultMin <= vaultMax <= totalLimit"
        );

        require(
            (_totalBorrowLimit != totalBorrowLimit) ||
            (_vaultBorrowMinimum != vaultBorrowMinimum) ||
            (_vaultBorrowMaximum != vaultBorrowMaximum),
            "SapphireCoreV1: the same limits are already set"
        );

        vaultBorrowMinimum = _vaultBorrowMinimum;
        vaultBorrowMaximum = _vaultBorrowMaximum;
        totalBorrowLimit = _totalBorrowLimit;

        emit LimitsUpdated(totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum);
    }

    /**
     * @dev Set the address which can set interest rate
     *
     * @notice Can only be called by the admin
     *
     * @param _interestSetter The address of the new interest rate setter
     */
    function setInterestSetter(
        address _interestSetter
    )
        external
        onlyAdmin
    {
        require(
            _interestSetter != interestSetter,
            "SapphireCoreV1: cannot set the same interest setter"
        );

        interestSetter = _interestSetter;
        emit InterestSetterUpdated(interestSetter);
    }

    function setPauseOperator(
        address _pauseOperator
    )
        external
        onlyAdmin
    {
        require(
            _pauseOperator != pauseOperator,
            "SapphireCoreV1: the same pause operator is already set"
        );

        pauseOperator = _pauseOperator;
        emit PauseOperatorUpdated(pauseOperator);
    }

    function setAssessor(
        address _assessor
    )
        public
        onlyAdmin
    {
        require(
            _assessor.isContract(),
            "SapphireCoreV1: the address is not a contract"
        );

        require(
            _assessor != address(assessor),
            "SapphireCoreV1: the same assessor is already set"
        );

        assessor = ISapphireAssessor(_assessor);
        emit AssessorUpdated(_assessor);
    }

    function setFeeCollector(
        address _newFeeCollector
    )
        external
        onlyAdmin
    {
        require(
            _newFeeCollector != address(feeCollector),
            "SapphireCoreV1: the same fee collector is already set"
        );

        feeCollector = _newFeeCollector;
        emit FeeCollectorUpdated(feeCollector);
    }

    function setPause(
        bool _value
    )
        external
    {
        require(
            msg.sender == pauseOperator,
            "SapphireCoreV1: caller is not the pause operator"
        );

        require(
            _value != paused,
            "SapphireCoreV1: cannot set the same pause value"
        );

        paused = _value;
        emit PauseStatusUpdated(paused);
    }

    /**
     * @dev Update the interest rate of the protocol. Since this rate is compounded
     *      every second rather than being purely linear, the calculate for r is expressed
     *      as the following (assuming you want 5% APY):
     *
     *      r^N = 1.05
     *      since N = 365 * 24 * 60 * 60 (number of seconds in a year)
     *      r = 1.000000001547125957863212...
     *      rate = 1547125957 (r - 1e18 decimal places solidity value)
     *
     * @notice Can only be called by the interest setter of the protocol and the maximum
     *         rate settable is 99% (21820606489)
     *
     * @param _interestRate The interest rate expressed per second
     */
    function setInterestRate(
        uint256 _interestRate
    )
        external
    {

        require(
            msg.sender == interestSetter,
            "SapphireCoreV1: caller is not interest setter"
        );

        require(
            _interestRate < 21820606489,
            "SapphireCoreV1: interest rate cannot be more than 99% - 21820606489"
        );

        interestRate = _interestRate;
        emit InterestRateUpdated(interestRate);
    }

    /* ========== Public Functions ========== */

    /**
     * @dev Deposits the given `_amount` of collateral to the `msg.sender`'s vault.
     *
     * @param _amount The amount of collateral to deposit
     * @param _scoreProof The credit score proof - optional
     */
    function deposit(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](1);
        actions[0] = SapphireTypes.Action(
            _amount,
            SapphireTypes.Operation.Deposit,
            address(0)
        );

        executeActions(actions, _scoreProof);
    }

    function withdraw(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](1);
        actions[0] = SapphireTypes.Action(
            _amount,
            SapphireTypes.Operation.Withdraw,
            address(0)
        );

        executeActions(actions, _scoreProof);
    }

    /**
     * @dev Borrow against an existing position
     *
     * @param _amount The amount of synthetic to borrow
     * @param _scoreProof The credit score proof - mandatory
     */
    function borrow(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](1);
        actions[0] = SapphireTypes.Action(
            _amount,
            SapphireTypes.Operation.Borrow,
            address(0)
        );

        executeActions(actions, _scoreProof);
    }

    function repay(
        uint256 _amount,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](1);
        actions[0] = SapphireTypes.Action(
            _amount,
            SapphireTypes.Operation.Repay,
            address(0)
        );

        executeActions(actions, _scoreProof);
    }

    /**
     * @dev Repays the entire debt and withdraws the all the collateral
     *
     * @param _scoreProof The credit score proof - optional
     */
    function exit(
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](2);
        SapphireTypes.Vault memory vault = vaults[msg.sender];

        uint256 repayAmount = _denormalizeBorrowAmount(vault.borrowedAmount, true);

        // Repay outstanding debt
        actions[0] = SapphireTypes.Action(
            repayAmount,
            SapphireTypes.Operation.Repay,
            address(0)
        );

        // Withdraw all collateral
        actions[1] = SapphireTypes.Action(
            vault.collateralAmount,
            SapphireTypes.Operation.Withdraw,
            address(0)
        );

        executeActions(actions, _scoreProof);
    }

    /**
     * @dev Liquidate a user's vault. When this process occurs you're essentially
     *      purchasing the user's debt at a discount in exchange for the collateral
     *      they have deposited inside their vault.
     *
     * @param _owner the owner of the vault to liquidate
     * @param _scoreProof The credit score proof (optional)
     */
    function liquidate(
        address _owner,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        SapphireTypes.Action[] memory actions = new SapphireTypes.Action[](1);
        actions[0] = SapphireTypes.Action(
            0,
            SapphireTypes.Operation.Liquidate,
            _owner
        );

        executeActions(actions, _scoreProof);
    }

    /**
     * @dev All other user-called functions use this function to execute the
     *      passed actions. This function first updates the indexes before
     *      actually executing the actions.
     *
     * @param _actions      An array of actions to execute
     * @param _scoreProof   The credit score proof of the user that calls this
     *                      function
     */
    function executeActions(
        SapphireTypes.Action[] memory _actions,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        require(
            !paused,
            "SapphireCoreV1: the contract is paused"
        );

        require(
            _actions.length > 0,
            "SapphireCoreV1: there must be at least one action"
        );

        // Update the index to calculate how much interest has accrued
        updateIndex();

        // Get the c-ratio and current price if necessary. The current price only be >0 if
        // it's required by an action
        (
            uint256 assessedCRatio,
            uint256 currentPrice
        ) = _getVariablesForActions(_actions, _scoreProof);

        for (uint256 i = 0; i < _actions.length; i++) {
            SapphireTypes.Action memory action = _actions[i];

            if (action.operation == SapphireTypes.Operation.Deposit) {
                _deposit(action.amount);

            } else if (action.operation == SapphireTypes.Operation.Withdraw){
                _withdraw(action.amount, assessedCRatio, currentPrice);

            } else if (action.operation == SapphireTypes.Operation.Borrow) {
                _borrow(action.amount, assessedCRatio, currentPrice);

            }  else if (action.operation == SapphireTypes.Operation.Repay) {
                _repay(msg.sender, msg.sender, action.amount);

            } else if (action.operation == SapphireTypes.Operation.Liquidate) {
                _liquidate(action.userToLiquidate, currentPrice, assessedCRatio);
            }
        }

        emit ActionsOperated(
            _actions,
            _scoreProof,
            msg.sender
        );
    }

    function updateIndex()
        public
        returns (uint256)
    {
        if (indexLastUpdate == currentTimestamp()) {
            return borrowIndex;
        }

        borrowIndex = currentBorrowIndex();
        indexLastUpdate = currentTimestamp();

        emit IndexUpdated(borrowIndex, indexLastUpdate);

        return borrowIndex;
    }

    /* ========== Public Getters ========== */

    function accumulatedInterest()
        public
        view
        returns (uint256)
    {
        return interestRate.mul(currentTimestamp().sub(indexLastUpdate));
    }

    function currentBorrowIndex()
        public
        view
        returns (uint256)
    {
        return borrowIndex.mul(accumulatedInterest()).div(BASE).add(borrowIndex);
    }

    /**
     * @dev Check if the vault is collateralized or not
     *
     * @param _owner The owner of the vault
     * @param _currentPrice The current price of the collateral
     * @param _assessedCRatio The assessed collateral ratio of the owner
     */
    function isCollateralized(
        address _owner,
        uint256 _currentPrice,
        uint256 _assessedCRatio
    )
        public
        view
        returns (bool)
    {
        SapphireTypes.Vault memory vault = vaults[_owner];

        if (vault.borrowedAmount == 0) {
            return true;
        }

        uint256 currentCRatio = calculateCollateralRatio(
            vault.borrowedAmount,
            vault.collateralAmount,
            _currentPrice
        );

        return currentCRatio >= _assessedCRatio;
    }

    /* ========== Developer Functions ========== */

    /**
     * @dev Returns current block's timestamp
     *
     * @notice This function is introduced in order to properly test time delays in this contract
     */
    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }

    /**
     * @dev Calculate how much collateralRatio you would have
     *      with a certain borrow and collateral amount
     *
     * @param _borrowedAmount   The borrowed amount expressed as a uint256 (NOT principal)
     * @param _collateralAmount The amount of collateral, in its original decimals
     * @param _collateralPrice  What price do you want to calculate the inverse at
     * @return                  The calculated c-ratio
     */
    function calculateCollateralRatio(
        uint256 _borrowedAmount,
        uint256 _collateralAmount,
        uint256 _collateralPrice
    )
        public
        view
        returns (uint256)
    {
        return _collateralAmount
            .mul(precisionScalar)
            .mul(_collateralPrice)
            .div(_borrowedAmount);
    }

    /* ========== Private Functions ========== */

    /**
     * @dev Normalize the given borrow amount by dividing it with the borrow index.
     *      It is used when manipulating with other borrow values
     *      in order to take in account current borrowIndex.
     */
    function _normalizeBorrowAmount(
        uint256 _amount,
        bool _roundUp
    )
        private
        view
        returns (uint256)
    {
        if (_amount == 0) return _amount;

        if (_roundUp) {
            return Math.roundUpDiv(_amount, currentBorrowIndex());
        }

        return _amount
            .mul(BASE)
            .div(currentBorrowIndex());
    }

    /**
     * @dev Multiply the given amount by the borrow index. Used to convert
     *      borrow amounts back to their real value.
     */
    function _denormalizeBorrowAmount(
        uint256 _amount,
        bool _roundUp
    )
        private
        view
        returns (uint256)
    {
        if (_amount == 0) return _amount;

        if (_roundUp) {
            return Math.roundUpMul(_amount, currentBorrowIndex());
        }

        return _amount
            .mul(currentBorrowIndex())
            .div(BASE);
    }

    /**
     * @dev Deposits the collateral amount in the user's vault
     */
    function _deposit(
        uint256 _amount
    )
        private
    {
        // Record deposit
        SapphireTypes.Vault storage vault = vaults[msg.sender];

        if (_amount == 0) {
            return;
        }

        vault.collateralAmount = vault.collateralAmount.add(_amount);

        totalCollateral = totalCollateral.add(_amount);

        // Execute transfer
        IERC20 collateralAsset = IERC20(collateralAsset);
        SafeERC20.safeTransferFrom(
            collateralAsset,
            msg.sender,
            address(this),
            _amount
        );
    }

    /**
     * @dev Withdraw the collateral amount in the user's vault, then ensures
     *      the withdraw amount is not greater than the deposited collateral.
     *      Afterwards ensure that collateral limit is not smaller than returned
     *      from assessor one.
     */
    function _withdraw(
        uint256 _amount,
        uint256 _assessedCRatio,
        uint256 _collateralPrice
    )
        private
    {
        SapphireTypes.Vault storage vault = vaults[msg.sender];

        require(
            vault.collateralAmount >= _amount,
            "SapphireCoreV1: cannot withdraw more collateral than the vault balance"
        );

        vault.collateralAmount = vault.collateralAmount.sub(_amount);

        // if we don't have debt we can withdraw as much as we want.
        if (vault.borrowedAmount > 0) {
            uint256 collateralRatio = calculateCollateralRatio(
                _denormalizeBorrowAmount(vault.borrowedAmount, true),
                vault.collateralAmount,
                _collateralPrice
            );

            require(
                collateralRatio >= _assessedCRatio,
                "SapphireCoreV1: the vault will become undercollateralized"
            );
        }

        // Change total collateral amount
        totalCollateral = totalCollateral.sub(_amount);

        // Execute transfer
        IERC20 collateralAsset = IERC20(collateralAsset);
        SafeERC20.safeTransfer(collateralAsset, msg.sender, _amount);
    }

    /**
     * @dev Borrows synthetic against the user's vault. It ensures the vault
     *      still maintains the required collateral ratio
     *
     * @param _amount           The amount of synthetic to borrow, in 18 decimals
     * @param _assessedCRatio   The assessed c-ratio for user's credit score
     * @param _collateralPrice  The current collateral price
     */
    function _borrow(
        uint256 _amount,
        uint256 _assessedCRatio,
        uint256 _collateralPrice
    )
        private
    {
        // Get the user's vault
        SapphireTypes.Vault storage vault = vaults[msg.sender];

        uint256 denormalizedBorrowAmount = _denormalizeBorrowAmount(vault.borrowedAmount, true);

        // Ensure the vault is collateralized if the borrow action succeeds
        uint256 collateralRatio = calculateCollateralRatio(
            denormalizedBorrowAmount
                .add(_amount),
            vault.collateralAmount,
            _collateralPrice
        );

        require(
            collateralRatio >= _assessedCRatio,
            "SapphireCoreV1: the vault will become undercollateralized"
        );

        // Calculate actual vault borrow amount
        uint256 actualVaultBorrowAmount = denormalizedBorrowAmount;

        // Calculate new actual vault borrow amount
        uint256 _newActualVaultBorrowAmount = actualVaultBorrowAmount.add(_amount);

        // Calculate new normalized vault borrow amount
        uint256 _newNormalizedVaultBorrowAmount = _normalizeBorrowAmount(_newActualVaultBorrowAmount, true);

        // Record borrow amount (update vault and total amount)
        totalBorrowed = totalBorrowed.sub(vault.borrowedAmount).add(_newNormalizedVaultBorrowAmount);
        vault.borrowedAmount = _newNormalizedVaultBorrowAmount;

        // Do not borrow more than the maximum vault borrow amount
        require(
            _newActualVaultBorrowAmount <= vaultBorrowMaximum,
            "SapphireCoreV1: borrowed amount cannot be greater than vault limit"
        );

        // Do not borrow if amount is smaller than limit
        require(
            _newActualVaultBorrowAmount >= vaultBorrowMinimum,
            "SapphireCoreV1: borrowed amount cannot be less than limit"
        );

        require(
            _denormalizeBorrowAmount(totalBorrowed, true) <= totalBorrowLimit,
            "SapphireCoreV1: borrowed amount cannot be greater than limit"
        );

        // Mint tokens
        ISyntheticTokenV2(syntheticAsset).mint(
            msg.sender,
            _amount
        );
    }

    /**
     * @dev Repays the given `_amount` of the synthetic back
     *
     * @param _owner The owner of the vault
     * @param _repayer The person who repays the debt
     * @param _amount The amount to repay
     */
    function _repay(
        address _owner,
        address _repayer,
        uint256 _amount
    )
        private
    {
        // Get the user's vault
        SapphireTypes.Vault storage vault = vaults[_owner];

        // Calculate actual vault borrow amount
        uint256 actualVaultBorrowAmount = _denormalizeBorrowAmount(vault.borrowedAmount, true);

        require(
            _amount <= actualVaultBorrowAmount,
            "SapphireCoreV1: there is not enough debt to repay"
        );

        // Calculate new vault's borrowed amount
        uint256 _newBorrowAmount = _normalizeBorrowAmount(actualVaultBorrowAmount.sub(_amount), true);

        // Update total borrow amount
        totalBorrowed = totalBorrowed.sub(vault.borrowedAmount).add(_newBorrowAmount);

        // Update vault
        vault.borrowedAmount = _newBorrowAmount;

        // Transfer tokens to the core
        ISyntheticTokenV2(syntheticAsset).transferFrom(
            _repayer,
            address(this),
            _amount
        );
        // Destroy `_amount` of tokens tokens that the core owns
        ISyntheticTokenV2(syntheticAsset).destroy(
            _amount
        );
    }

    function _liquidate(
        address _owner,
        uint256 _currentPrice,
        uint256 _assessedCRatio
    )
        private
    {
        // CHECKS:
        // 1. Ensure that the position is valid (check if there is a non-0x0 owner)
        // 2. Ensure that the position is indeed undercollateralized

        // EFFECTS:
        // 1. Calculate the liquidation price based on the liquidation penalty
        // 2. Calculate the amount of collateral to be sold based on the entire debt
        //    in the vault
        // 3. If the discounted collateral is more than the amount in the vault, limit
        //    the sale to that amount
        // 4. Decrease the owner's debt
        // 5. Decrease the owner's collateral

        // INTEGRATIONS
        // 1. Transfer the debt to pay from the liquidator to the core
        // 2. Destroy the debt to be paid
        // 3. Transfer the user portion of the collateral sold to the msg.sender
        // 4. Transfer Arc's portion of the profit to the fee collector

        // --- CHECKS ---

        require(
            _owner != address(0),
            "SapphireCoreV1: position owner cannot be address 0"
        );

        SapphireTypes.Vault storage vault = vaults[_owner];

        // Ensure that the vault is not collateralized
        require(
            !isCollateralized(
                _owner,
                _currentPrice,
                _assessedCRatio
            ),
            "SapphireCoreV1: vault is collateralized"
        );

        // --- EFFECTS ---

        // Get the liquidation price of the asset (discount for liquidator)
        uint256 liquidationPriceRatio = BASE.sub(liquidationUserRatio);
        uint256 liquidationPrice = Math.roundUpMul(_currentPrice, liquidationPriceRatio);

        // Calculate the amount of collateral to be sold based on the entire debt
        // in the vault
        uint256 debtToRepay = _denormalizeBorrowAmount(vault.borrowedAmount, true);

        // Do a rounded up operation of
        // debtToRepay / LiquidationFee / precisionScalar
        uint256 collateralToSell = Math.roundUpDiv(debtToRepay, liquidationPrice)
            .add(precisionScalar.sub(1))
            .div(precisionScalar);

        // If the discounted collateral is more than the amount in the vault, limit
        // the sale to that amount
        if (collateralToSell > vault.collateralAmount) {
            collateralToSell = vault.collateralAmount;
            // Calculate the new debt to repay
            debtToRepay = collateralToSell
                .mul(precisionScalar)
                .mul(liquidationPrice)
                .div(BASE);
        }

        // Calculate the profit made in USD
        uint256 valueCollateralSold = collateralToSell
            .mul(precisionScalar)
            .mul(_currentPrice)
            .div(BASE);

        // Total profit in dollar amount
        uint256 profit = valueCollateralSold.sub(debtToRepay);

        // Calculate the ARC share
        uint256 arcShare = profit
            .mul(liquidationArcRatio)
            .div(liquidationPrice)
            .div(precisionScalar);

        // Calculate liquidator's share
        uint256 liquidatorCollateralShare = collateralToSell.sub(arcShare);

        // Update owner's vault
        vault.collateralAmount = vault.collateralAmount
            .sub(collateralToSell);

        // --- INTEGRATIONS ---

        // Repay the debt
        _repay(
            _owner,
            msg.sender,
            debtToRepay
        );

        // Transfer user collateral
        IERC20 collateralAsset = IERC20(collateralAsset);
        SafeERC20.safeTransfer(
            collateralAsset,
            msg.sender,
            liquidatorCollateralShare
        );

        // Transfer Arc's share of collateral
        SafeERC20.safeTransfer(
            collateralAsset,
            feeCollector,
            arcShare
        );
    }

    /**
     * @dev Gets the required variables for the actions passed, if needed. The credit score
     *      will be assessed if there is at least one action. The oracle price will only be
     *      fetched if there is at least one borrow or liquidate actions.
     *
     * @param _actions      the actions that are about to be ran
     * @param _scoreProof   the credit score proof
     * @return              the assessed c-ratio and the current collateral price
     */
    function _getVariablesForActions(
        SapphireTypes.Action[] memory _actions,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        private
        returns (uint256, uint256)
    {
        uint256 assessedCRatio;
        uint256 collateralPrice;
        uint256 collateralPriceTimestamp;

        bool mandatoryProof = false;
        bool needsCollateralPrice = false;

        // Check if the score proof has an address. If it's address zero,
        // replace it with msg.sender. This is to prevent users from borrowing
        // after having already registered a score on chain

        if (_scoreProof.account == address(0)) {
            _scoreProof.account = msg.sender;
        }

        for (uint256 i = 0; i < _actions.length; i++) {
            SapphireTypes.Action memory action = _actions[i];

            if (action.operation == SapphireTypes.Operation.Borrow ||
                action.operation == SapphireTypes.Operation.Liquidate
            ) {
                mandatoryProof = true;
                needsCollateralPrice = true;

            } else if (action.operation == SapphireTypes.Operation.Withdraw) {
                needsCollateralPrice = true;
            }

            /**
            * Ensure the credit score proof refers to the correct account given
            * the action.
            */
            if (action.operation == SapphireTypes.Operation.Borrow ||
                action.operation == SapphireTypes.Operation.Withdraw
            ) {
                require(
                    _scoreProof.account == msg.sender,
                    "SapphireCoreV1: proof.account must match msg.sender"
                );
            } else if (action.operation == SapphireTypes.Operation.Liquidate) {
                require(
                    _scoreProof.account == action.userToLiquidate,
                    "SapphireCoreV1: proof.account does not match the user to liquidate"
                );
            }
        }

        if (needsCollateralPrice) {
            require(
                address(oracle) != address(0),
                "SapphireCoreV1: the oracle is not set"
            );

            // Collateral price denominated in 18 decimals
            (collateralPrice, collateralPriceTimestamp) = oracle.fetchCurrentPrice();

            require(
                _isOracleNotOutdated(collateralPriceTimestamp),
                "SapphireCoreV1: the oracle has stale prices"
            );

            require(
                collateralPrice > 0,
                "SapphireCoreV1: the oracle returned a price of 0"
            );
        }

        if (address(assessor) == address(0) || _actions.length == 0) {
            assessedCRatio = highCollateralRatio;
        } else {
            assessedCRatio = assessor.assess(
                lowCollateralRatio,
                highCollateralRatio,
                _scoreProof,
                mandatoryProof
            );
        }

        return (assessedCRatio, collateralPrice);
    }

    function _setFees(
        uint256 _liquidationUserRatio,
        uint256 _liquidationArcRatio
    )
        private
    {
        require(
            _liquidationUserRatio <= BASE &&
            _liquidationArcRatio <= BASE,
            "SapphireCoreV1: fees cannot be more than 100%"
        );

        liquidationUserRatio = _liquidationUserRatio;
        liquidationArcRatio = _liquidationArcRatio;
        emit LiquidationFeesUpdated(liquidationUserRatio, liquidationArcRatio);
    }

    /**
     * @dev Returns true if oracle is not outdated
     */
    function _isOracleNotOutdated(
        uint256 _oracleTimestamp
    )
        internal
        view
        returns (bool)
    {
        return _oracleTimestamp >= currentTimestamp().sub(60 * 60 * 12);
    }
}
