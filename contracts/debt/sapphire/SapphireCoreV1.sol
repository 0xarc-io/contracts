// SPDX-License-Identifier: MIT
// prettier-ignore

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {BaseERC20} from "../../token/BaseERC20.sol";
import {IERC20} from "../../token/IERC20.sol";
import {SafeERC20} from "../../lib/SafeERC20.sol";
import {SafeMath} from "../../lib/SafeMath.sol";
import {Adminable} from "../../lib/Adminable.sol";
import {IOracle} from "../../oracle/IOracle.sol";
import {Decimal} from "../../lib/Decimal.sol";
import {ISyntheticTokenV2} from "../../token/ISyntheticTokenV2.sol";

import {SapphireTypes} from "./SapphireTypes.sol";
import {SapphireCoreStorage} from "./SapphireCoreStorage.sol";
import {SapphireAssessor} from "./SapphireAssessor.sol";
import {ISapphireAssessor} from "./ISapphireAssessor.sol";

import "hardhat/console.sol";

contract SapphireCoreV1 is SapphireCoreStorage, Adminable {

    /* ========== Libraries ========== */

    using SafeMath for uint256;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Events ========== */

    event ActionsOperated(
        SapphireTypes.Action[] _actions,
        SapphireTypes.ScoreProof _scoreProof,
        address _user
    );

    event LiquidationFeesUpdated(
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    );

    event LimitsUpdated(
        uint256 _totalBorrowLimit,
        uint256 _valutBorrowMinimum,
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

    event AssessorUpdated(address _newAssessor);

    event CollateralRatiosUpdated(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    );

    event FeeCollectorUpdated(
        address _feeCollector
    );

    event TokensWithdrawn(
        address _token,
        address _destination,
        uint256 _amount
    );

    /* ========== Admin Setters ========== */

    /**
     * @dev Initialize the protocol with the appropriate parameters. Can only be called once.
     *
     * @param _collateralAddress    The address of the collateral to be used
     * @param _syntheticAddress     The address of the synthetic token proxy
     * @param _oracleAddress        The address of the IOracle conforming contract
     * @param _interestSetter       The address which can update interest rates
     * @param _assessor,            The address of assessor contract, which provides credit score functionality
     * @param _feeCollector         The address of the ARC fee collector when a liquidation occurs
     * @param _highCollateralRatio  High limit of how much collateral is needed to borrow
     * @param _lowCollateralRatio   Low limit of how much collateral is needed to borrow
     * @param _liquidationUserFee   How much is a user penalized if they go below their c-ratio
     * @param _liquidationArcFee    How much of the liquidation profit should ARC take
     */
    function init(
        address _collateralAddress,
        address _syntheticAddress,
        address _oracleAddress,
        address _interestSetter,
        address _assessor,
        address _feeCollector,
        uint256 _highCollateralRatio,
        uint256 _lowCollateralRatio,
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    )
        public
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

        paused = true;
        borrowIndex = BASE;
        indexLastUpdate = currentTimestamp();
        collateralAsset = _collateralAddress;
        syntheticAsset = _syntheticAddress;
        interestSetter = _interestSetter;
        feeCollector = _feeCollector;

        BaseERC20 collateral = BaseERC20(collateralAsset);
        precisionScalar = 10 ** (18 - uint256(collateral.decimals()));

        setAssessor(_assessor);
        setOracle(_oracleAddress);
        setCollateralRatios(_lowCollateralRatio, _highCollateralRatio);
        setFees(_liquidationUserFee, _liquidationArcFee);
    }

    function setOracle(
        address _oracle
    )
        public
        onlyAdmin
    {
        oracle = IOracle(_oracle);
        emit OracleUpdated(_oracle);
    }

    function setCollateralRatios(
        uint256 _lowCollateralRatio,
        uint256 _highCollateralRatio
    )
        public
        onlyAdmin
    {
        require(
            _lowCollateralRatio >= BASE &&  _highCollateralRatio >= BASE,
            "SapphireCoreV1: collateral ratio has to be at least 1"
        );

        require(
            _lowCollateralRatio <=  _highCollateralRatio,
            "SapphireCoreV1: high c-ratio is lower than the low c-ratio"
        );

        lowCollateralRatio = _lowCollateralRatio;
        highCollateralRatio = _highCollateralRatio;

        emit CollateralRatiosUpdated(lowCollateralRatio, highCollateralRatio);
    }

    function setFees(
        uint256 _liquidationUserFee,
        uint256 _liquidationArcFee
    )
        public
        onlyAdmin
    {
        require(
            _liquidationUserFee.add(_liquidationArcFee) <= BASE,
            "SapphireCoreV1: fee sum has to be no more than 100%"
        );

        liquidationUserFee = _liquidationUserFee;
        liquidationArcFee = _liquidationArcFee;
        emit LiquidationFeesUpdated(liquidationUserFee, liquidationArcFee);
    }

    function setLimits(
        uint256 _totalBorrowLimit,
        uint256 _vaultBorrowMinimum,
        uint256 _vaultBorrowMaximum
    )
        public
        onlyAdmin
    {
        require(
            _vaultBorrowMinimum <= _vaultBorrowMaximum,
            "SapphireCoreV1: required condition is vaultMin <= vaultMax <= totalLimit"
        );

        require(
            _vaultBorrowMaximum <= _totalBorrowLimit,
            "SapphireCoreV1: required condition is vaultMin <= vaultMax <= totalLimit"
        );

        vaultBorrowMinimum = _vaultBorrowMinimum;
        vaultBorrowMaximum = _vaultBorrowMaximum;
        totalBorrowLimit = _totalBorrowLimit;

        emit LimitsUpdated(totalBorrowLimit, vaultBorrowMinimum, vaultBorrowMaximum);
    }

    function setInterestSetter(
        address _interestSetter
    )
        public
        onlyAdmin
    {
        interestSetter = _interestSetter;
        emit InterestSetterUpdated(interestSetter);
    }

    function setAssessor(
        address _assessor
    )
        public
        onlyAdmin
    {
        assessor = ISapphireAssessor(_assessor);
        emit AssessorUpdated(_assessor);
    }

    function setFeeCollector(
        address _newFeeCollector
    )
        public
        onlyAdmin
    {
        feeCollector = _newFeeCollector;
        emit FeeCollectorUpdated(feeCollector);
    }

    function setPause(
        bool _value
    )
        public
        onlyAdmin
    {
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
     *      rate = 1000000001547125957 (18 decimal places solidity value)
     *
     * @notice Can only be called by the interest setter of the protocol and the maximum
     *         rate settable by the admin is 99% (21820606489)
     *
     * @param _interestRate The interest rate expressed per second
     */
    function setInterestRate(
        uint256 _interestRate
    )
        public
    {

        require(
            msg.sender == interestSetter, 
            "SapphireCoreV1: caller is not interest setter"
        );

        require(
            _interestRate < 21820606489,
            "SapphireCoreV1: APY cannot be more than 99%, interest rate - 21820606489"
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
            SapphireTypes.Operation.Deposit
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
            SapphireTypes.Operation.Withdraw
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
            SapphireTypes.Operation.Borrow
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
            SapphireTypes.Operation.Repay
        );

        executeActions(actions, _scoreProof);
    }

    function liquidate(
        address _owner,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {

    }

    /**
     * @dev All other user-called functions use this function to execute the
     *      passed actions. This function first updates the indeces before
     *      actually executing the actions.
     *
     * @param _actions      An array of actions to execute
     * @param _scoreProof   The credit score proof of the user that calles this
     *                      function
     */
    function executeActions(
        SapphireTypes.Action[] memory _actions,
        SapphireTypes.ScoreProof memory _scoreProof
    )
        public
    {
        require(
            paused == false,
            "SapphireCoreV1: the contract is paused"
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
                _repay(action.amount);
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

    }

    /* ========== Public Getters ========== */

    function accumulatedInterest()
        public
        view
        returns (uint256)
    {

    }

    function currentBorrowIndex()
        public
        view
        returns (uint256)
    {

    }

    /**
     * @notice Returns the vault with the normalized borrow amount, which includes
     *         the accumulated interest.
     */
    function getVault(
        address _user
    )
        public
        view
        returns (SapphireTypes.Vault memory)
    {
        SapphireTypes.Vault memory vault = vaults[_user];
        vault.borrowedAmount = _normalizeBorrowAmount(vault.borrowedAmount);

        return vault;
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
        uint256 _amount
    )
        private
        view
        returns (uint256)
    {
        return _amount.mul(BASE).div(borrowIndex);
    }

    /**
     * @dev Multiply the given amount by the borrow index. Used to convert
     *      borrow amounts back to their real value.
     */
    function _denormalizeBorrowAmount(
        uint256 _amount
    )
        private
        view
        returns (uint256)
    {
        return _amount.mul(borrowIndex).div(BASE);
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
     *      Afterwards ensure that collatteral limit is not smaller than returned
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

        vault.collateralAmount = vault.collateralAmount.sub(_amount);

        // if we don't have debt we can withdraw as much as we want
        if (vault.borrowedAmount > 0) {

            uint256 collateralRatio = calculateCollateralRatio(
                _denormalizeBorrowAmount(vault.borrowedAmount),
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

        // Ensure the vault is collateralized if the borrow action succeeds
        uint256 collateralRatio = calculateCollateralRatio(
            vault.borrowedAmount
                .mul(borrowIndex)
                .div(BASE)
                .add(_amount),
            vault.collateralAmount,
            _collateralPrice
        );

        require(
            collateralRatio >= _assessedCRatio,
            "SapphireCoreV1: the vault will become undercollateralized"
        );

        // Record borrow amount (update vault and total amount)
        uint256 normalizedBorrowAmount = _normalizeBorrowAmount(_amount);
        vault.borrowedAmount = vault.borrowedAmount.add(normalizedBorrowAmount);
        totalBorrowed = totalBorrowed.add(normalizedBorrowAmount);

        uint256 actualVaultBorrowAmount = _denormalizeBorrowAmount(vault.borrowedAmount);

        // Do not borrow more than the maximum vault borrow amount
        require(
            actualVaultBorrowAmount <= vaultBorrowMaximum,
            "SapphireCoreV1: borrowed amount cannot be greater than vault limit"
        );

        // Do not borrow if amount is smaller than limit
        require(
            actualVaultBorrowAmount >= vaultBorrowMinimum,
            "SapphireCoreV1: borrowed amount cannot be less than limit"
        );

        require(
            _denormalizeBorrowAmount(totalBorrowed) <= totalBorrowLimit,
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
     * @param _amount The amount to repay
     */
    function _repay(
        uint256 _amount
    )
        private
    {
        // Get the user's vault
        SapphireTypes.Vault storage vault = vaults[msg.sender];

        // Update vault
        uint256 convertedBorrowAmount = _normalizeBorrowAmount(_amount);

        require(
            convertedBorrowAmount <= vault.borrowedAmount,
            "SapphireCoreV1: there is not enough debt to repay"
        );

        // Update vault
        vault.borrowedAmount = vault.borrowedAmount.sub(convertedBorrowAmount);

        // Update total borrow amount
        totalBorrowed = totalBorrowed.sub(convertedBorrowAmount);

        // Transfer tokens to the core
        ISyntheticTokenV2(syntheticAsset).transferFrom(
            msg.sender,
            address(this),
            _amount
        );
        // Destroy `_amount` of tokens tokens that the core owns
        ISyntheticTokenV2(syntheticAsset).destroy(
            _amount
        );
    }

    function _liqiuidate(
        address owner
    )
        private
    {

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
        Decimal.D256 memory collateralPrice;

        bool mandatoryProof = false;
        bool needsCollateralPrice = false;

        require(
            address(assessor) != address(0),
            "SapphireCoreV1: the assessor is not set"
        );

        /**
         * Only the borrow action requires a mandatory score proof, so break
         * the loop when that action is found.
         */
        for (uint256 i = 0; i < _actions.length; i++) {
            SapphireTypes.Action memory action = _actions[i];

            if (action.operation == SapphireTypes.Operation.Borrow) {
                mandatoryProof = true;
                needsCollateralPrice = true;
                break;
            } else if (
                action.operation == SapphireTypes.Operation.Liquidate ||
                action.operation == SapphireTypes.Operation.Withdraw) {

                needsCollateralPrice = true;
            }
        }

        if (needsCollateralPrice) {
            require(
                address(oracle) != address(0),
                "SapphireCoreV1: the oracle is not set"
            );

            // Collateral price denominated in 18 decimals
            collateralPrice = oracle.fetchCurrentPrice();

            require(
                collateralPrice.value > 0,
                "SapphireCoreV1: the oracle returned a price of 0"
            );
        }

        assessedCRatio = assessor.assess(
            lowCollateralRatio,
            highCollateralRatio,
            _scoreProof,
            mandatoryProof
        );

        return (assessedCRatio, collateralPrice.value);
    }
}
