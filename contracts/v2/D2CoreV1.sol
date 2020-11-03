// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IMintableToken} from "../interfaces/IMintableToken.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {ID2Core} from "../interfaces/ID2Core.sol";

import {Adminable} from "../lib/Adminable.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Math} from "../lib/Math.sol";
import {Amount} from "../lib/Amount.sol";

import {D2Storage} from "./D2Storage.sol";
import {D2Types} from  "./D2Types.sol";

import {console} from "@nomiclabs/buidler/console.sol";

contract D2CoreV1 is Adminable, D2Storage, ID2Core {

    /* ========== Libraries ========== */

    using SafeMath for uint256;
    using Math for uint256;
    using Amount for Amount.Principal;

    /* ========== Constants ========== */

    uint256 constant BASE = 10**18;

    /* ========== Types ========== */

    enum Operation {
        Open,
        Borrow,
        Repay,
        Liquidate
    }

    struct OperationParams {
        uint256 id;
        uint256 amountOne;
        uint256 amountTwo;
    }

    /* ========== Events ========== */

    event ActionOperated(
        uint8 operation,
        OperationParams params,
        D2Types.Position updatedPosition
    );

    event ExcessTokensWithdrawn(
        address token,
        uint256 amount,
        address destination
    );

    event PauseStatusUpdated(
        bool value
    );

    /* ========== Constructor ========== */

    constructor()
        public
    {
        paused = true;
    }

    /* ========== Modifiers ========== */

    modifier isAuthorisedOperator(D2Types.Position memory position) {
        _;
    }

    /* ========== Admin Setters ========== */

    function init(
        address _collateralAddress,
        address _syntheticAddress,
        address _oracleAddress
    )
        public
        onlyAdmin
    {
        collateralAsset = _collateralAddress;
        syntheticAsset = _syntheticAddress;
        borrowIndex = uint256(10**18);
        indexLastUpdate = currentTimestamp();
        setOracle(_oracleAddress);
    }

    function setRate(
        uint256 _rate
    )
        public
        onlyAdmin
    {
        interestRate = _rate;
    }

    function setOracle(
        address _oracle
    )
        public
        onlyAdmin
    {
        oracle = IOracle(_oracle);
    }

    function setCollateralRatio(
        Decimal.D256 memory _collateralRatio
    )
        public
        onlyAdmin
    {
        collateralRatio = _collateralRatio;
    }

    function setPrinterDestination(
        address _printerDestination
    )
        public
        onlyAdmin
    {
        printerDestination = _printerDestination;
    }

    function setFees(
        Decimal.D256 memory _liquidationUserFee,
        Decimal.D256 memory _liquidationArcRatio,
        Decimal.D256 memory _printerArcRatio
    )
        public
        onlyAdmin
    {
        liquidationUserFee = _liquidationUserFee;
        liquidationArcRatio = _liquidationArcRatio;
        printerArcRatio = _printerArcRatio;
    }

    function setLimits(
        uint256 _collateralLimit,
        uint256 _syntheticLimit,
        uint256 _positionCollateralMinimum
    )
        public
        onlyAdmin
    {
        collateralLimit = _collateralLimit;
        syntheticLimit = _syntheticLimit;
        positionCollateralMinimum = _positionCollateralMinimum;
    }

    /* ========== Public Functions ========== */

    /**
     * @dev This is the only function that can be called by user's of the system
     *      and uses an enum and struct to parse the args. This structure guarantees
     *      the state machine will always meet certain properties
     *
     * @param operation An enum of the operation to execute
     * @param params Parameters to exceute the operation against
     */
    function operateAction(
        Operation operation,
        OperationParams memory params
    )
        public
    {

        D2Types.Position memory operatedPosition;

        // Update the index to calculate how much interest has accrued
        // And then subsequently mint more of the synth to the printer
        updateIndexAndPrint();

        if (operation == Operation.Open) {
            (operatedPosition, params.id) = openPosition(
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Borrow) {
            operatedPosition = borrow(
                params.id,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Repay) {
            operatedPosition = repay(
                params.id,
                params.amountOne,
                params.amountTwo
            );
        } else if (operation == Operation.Liquidate) {
            operatedPosition = liquidate(
                params.id
            );
        }

        emit ActionOperated(
            uint8(operation),
            params,
            operatedPosition
        );
    }

    /**
     * @dev This function allows a user to add an authorised operator for themselves which allows
     *      for simplified user interactions via a wrapper contract that makes multiple calls.
     *
     * @param operator Address of the user/operator who you would like to grant access to
     */
    function setAuthorisedOperator(
        address operator
    )
        public
        returns (bool)
    {

    }

    /**
     * @dev Update the index of the contracts to compute the current interest rate.
     *      This function simply calculates the last time this function was called
     *      (in seconds) then multiplied by the interest rate. The result is then
     *      multiplied by the totalBorrowed amount.
    */
    function updateIndexAndPrint()
        public
    {
        if (currentTimestamp() == indexLastUpdate || totalBorrowed == 0) {
            return;
        }

        // First we multiply the interest rate (expressed in rate/sec) by the time since
        // the last update. This result represents the proprtional amount of interest to
        // apply to the system at a whole
        console.log("Interest rate: %s", interestRate);
        uint256 interestAccumulated = interestRate.mul(currentTimestamp().sub(indexLastUpdate));
        console.log("time since last update: %s", currentTimestamp().sub(indexLastUpdate));
        console.log("interestAccumulated: %s", interestAccumulated);

        // Then we multiply the existing index by the newly generated rate so that we can
        // get a compounded interest rate.
        // ie. interestAccumulated = 0.1, borrowIndex = 1.1, new borrowIndex = 0.1 + 1.1 = 1.2
        console.log("Old borrowIndex: %s", borrowIndex);
        borrowIndex = borrowIndex.add(interestAccumulated);
        console.log("Updated borrowIndex: %s", borrowIndex);

        // Let's save the existing total borrows in the system before we updated it
        uint256 existingBorrow = totalBorrowed;
        console.log("existing totalBorrowed: %s", existingBorrow);

        // Update the total borrows based on the proportional rate of interest applied
        // to the entire system
        totalBorrowed = totalBorrowed.mul(borrowIndex).div(BASE);
        console.log("new totalBorrowed: %s", totalBorrowed);

        // With the difference between the new amount being borrowed and the existing amount
        // we can figure out how much interest is owed to the system as a whole and therefore
        // calculate how much of the synth to mint
        uint256 interestOwed = totalBorrowed.sub(existingBorrow);
        console.log("interestOwed: %s", interestOwed);

        uint256 arcProfit = Decimal.mul(
            interestOwed,
            printerArcRatio
        );

        indexLastUpdate = currentTimestamp();

        console.log("arc profit: %s", arcProfit);

        ISyntheticToken(syntheticAsset).mint(
            address(this),
            arcProfit
        );

        ISyntheticToken(syntheticAsset).mint(
            printerDestination,
            interestOwed.sub(arcProfit)
        );

    }

    /* ========== Admin Functions ========== */

    /**
     * @dev Withdraw tokens owned by the proxy. This will never include depositor funds
     *      since all the collateral is held by the synthetic token itself. The only funds
     *      that will accrue based on CoreV1 & StateV1 is the liquidation fees.
     *
     * @param token Address of the token to withdraw
     * @param destination Destination to withdraw to
     * @param amount The total amount of tokens withdraw
     */
    function withdrawTokens(
        address token,
        address destination,
        uint256 amount
    )
        external
        onlyAdmin
    {
        SafeERC20.safeTransfer(
            IERC20(token),
            destination,
            amount
        );
    }

    function setPause(bool value)
        external
        onlyAdmin
    {
        paused = value;

        emit PauseStatusUpdated(value);
    }

    /* ========== Internal Functions ========== */

    /**
     * @dev Open a new position.
     *
     * @return The new position and the ID of the opened position
     */
    function openPosition(
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        internal
        returns (D2Types.Position memory, uint256)
    {
        // CHECKS:
        // 1. No checks required as it's all processed in borrow()

        // EFFECTS:
        // 1. Create a new Position struct with the basic fields filled out and save it to storage
        // 2. Call `borrowPosition()`

        D2Types.Position memory newPosition = D2Types.Position({
            owner: msg.sender,
            collateralAmount: Amount.zero(),
            borrowedAmount: Amount.zero()
        });

        // This position is saved to storage to make the logic around borrowing
        // uniform. This is slightly gas inefficient but ok given the ability to
        // ensure no diverging logic.

        uint256 positionId = positionCount;
        positions[positionCount] = newPosition;
        positionCount = positionCount.add(1);

        newPosition = borrow(
            positionId,
            collateralAmount,
            borrowAmount
        );

        return (
            newPosition,
            positionId
        );
    }

    /**
     * @dev Borrow against an existing position.
     *
     * @param positionId ID of the position you'd like to borrow against
     * @param collateralAmount Collateral deposit amount
     * @param borrowAmount How much would you'd like to borrow/mint
     */
    function borrow(
        uint256 positionId,
        uint256 collateralAmount,
        uint256 borrowAmount
    )
        internal
        returns (D2Types.Position memory)
    {
        // CHECKS:
        // 1. Ensure that the position actually exists
        // 2. Conver the borrow amount to a Principal value
        // 3. Ensure the position is collateralised before borrowing against it
        // 4. Ensure that msg.sender == owner of position
        // 5. Determine if there's enough liquidity of the `borrowAsset`
        // 6. Calculate the amount of collateral actually needed given the `collateralRatio`
        // 7. Ensure the user has provided enough of the collateral asset

        // EFFECTS:
        // 1. Increase the collateral amount to calculate the maximum the amount the user can borrow
        // 2. Calculate the proportional new par value based on the borrow amount
        // 3. Update the total supplied collateral amount
        // 4. Calculate the collateral needed and ensuring the position has that much

        // INTERACTIONS:
        // 1. Mint the synthetic asset
        // 2. Transfer the collateral to the synthetic token itself.
        //    This ensures on Etherscan people can see how much collateral is backing
        //    the synthetic

        // Get the current position
        D2Types.Position storage position = positions[positionId];

        require(
            position.owner == msg.sender,
            "borrowPosition(): must be a valid position"
        );

        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        // Increase the user's collateral amount & increase the global supplied amount
        position = setCollateralAmount(
            positionId,
            position.collateralAmount.add(
                Amount.Principal({
                    sign: true,
                    value: collateralAmount
                })
            )
        );

        // Only if they're borrowing
        if (borrowAmount > 0) {
            // Calculate the principal amount based on the current index of the market
            Amount.Principal memory convertedPrincipal = Amount.calculatePrincipal(
                borrowAmount,
                borrowIndex,
                false
            );

            // Set the total new borrowed amount. We need to use this function
            // in order to adjust the total borrowed amount proportionally as well.
            position = setBorrowAmount(
                positionId,
                position.borrowedAmount.add(convertedPrincipal)
            );

            // Check how much collateral they need based on their new position details
            Amount.Principal memory collateralRequired = calculateCollateralRequired(
                position.borrowedAmount.calculateAdjusted(borrowIndex),
                currentPrice
            );

            // Ensure the user's collateral amount is greater than the collateral needed
            require(
                position.collateralAmount.value >= collateralRequired.value,
                "borrowPosition(): not enough collateral provided"
            );
        }

        IERC20 syntheticAsset = IERC20(syntheticAsset);
        IERC20 collateralAsset = IERC20(collateralAsset);

        // Transfer the collateral asset to the synthetic contract
        SafeERC20.safeTransferFrom(
            collateralAsset,
            msg.sender,
            address(syntheticAsset),
            collateralAmount
        );

        // Mint the synthetic token to user opening the borrow position
        ISyntheticToken(address(syntheticAsset)).mint(
            msg.sender,
            borrowAmount
        );

        return position;
    }

    /**
     * @dev Repay money against a borrowed position. When this process occurs the position's
     *      debt will be reduced and in turn will allow them to withdraw their collateral should they choose.
     *
     * @param positionId ID of the position to repay
     * @param repayAmount Amount of debt to repay
     * @param withdrawAmount Amount of collateral to withdraw
     */
    function repay(
        uint256 positionId,
        uint256 repayAmount,
        uint256 withdrawAmount
    )
        private
        returns (D2Types.Position memory)
    {
        // CHECKS:
        // 1. Ensure the position actually exists by ensuring the owner == msg.sender
        // 2. The position does not have to be collateralised since we want people to repay
        //    before a liquidator does if they do actually have a chance

        // EFFECTS:
        // 1. Calculate the new par value of the position based on the amount they're going to repay
        // 2. Update the user's borrow amount by calling the setBorrowAmount() function
        // 3. Calculate how much collateral they can withdraw based on their new borrow amount
        // 4. Check if the amount being withdrawn is enough given their borrowing requirement
        // 5. Update the user's collateral amount by calling the setCollateralAmount() function

        // INTERACTIONS:
        // 1. Burn the synths being repaid directly from their wallet
        // 2. Transfer the collateral back to the user

        D2Types.Position storage position = positions[positionId];

        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        // Ensure the user is the owner of the position
        require(
            position.owner == msg.sender,
            "repay(): must be a valid position"
        );

        // Calculate the principal amount based on the current index of the market
        Amount.Principal memory convertedPrincipal = Amount.calculatePrincipal(
            repayAmount,
            borrowIndex,
            true
        );

        console.log("old borrow amount: %s", position.borrowedAmount.value);

        // Set the user's new borrow amount by decreasing their debt amount.
        // A positive par value will increase a negative par value.
        position = setBorrowAmount(
            positionId,
            position.borrowedAmount.add(convertedPrincipal)
        );

        console.log("new borrow amount: %s", position.borrowedAmount.value);

        // Calculate how much the user is allowed to withdraw given their debt was repaid
        Amount.Principal memory collateralDelta = calculateCollateralDelta(
            position.collateralAmount,
            position.borrowedAmount.calculateAdjusted(borrowIndex),
            currentPrice
        );

        // Ensure that the amount they are trying to withdraw is less than their limit
        // Also, make sure that the delta is positive (aka collateralized).
        console.log("collateralDelta Sign: %s", collateralDelta.sign);
        console.log("collateralDelta Value: %s", collateralDelta.value);
        require(
            collateralDelta.sign == true && withdrawAmount <= collateralDelta.value,
            "repay(): cannot withdraw more than allowed"
        );

        // Decrease the user's collateral amount by adding a negative principal amount
        position = setCollateralAmount(
            positionId,
            position.collateralAmount.add(
                Amount.Principal({
                    sign: false,
                    value: withdrawAmount
                })
            )
        );

        ISyntheticToken synthetic = ISyntheticToken(syntheticAsset);
        IERC20 collateralAsset = IERC20(collateralAsset);

        // Burn the synthetic asset from the user
        synthetic.burn(
            msg.sender,
            repayAmount
        );

        // Transfer collateral back to the user
        bool transferResult = synthetic.transferCollateral(
            address(collateralAsset),
            msg.sender,
            withdrawAmount
        );

        require(
            transferResult == true,
            "repay(): collateral failed to transfer"
        );

        return position;
    }

    /**
     * @dev Liquidate a user's position. When this process occurs you're essentially
     *      purchasing the users's debt at a discount (liquidation spread) in exchange
     *      for the collateral they have deposited inside their position.
     *
     * @param positionId ID of the position to liquidate
     */
    function liquidate(
        uint256 positionId
    )
        private
        returns (D2Types.Position memory)
    {
        // CHECKS:
        // 1. Ensure that the position is valid (check if there is a non-0x0 owner)
        // 2. Ensure that the position is indeed undercollateralized

        // EFFECTS:
        // 1. Calculate the liquidation price based on the liquidation penalty
        // 2. Calculate how much the user is in debt by
        // 3. Add the liquidation penalty to the liquidation amount so there's
        //    a buffer that exists to ensure they can't get liquidated again
        // 4. If the collateral to liquidate is greater than the collateral, bound it.
        // 5. Calculate how much of the borrowed asset is to be liquidated
        // 5. Decrease the user's debt obligation
        // 6. Decrease the user's collateral amount

        // INTERACTIONS:
        // 1. Burn the synthetic from the liquidator
        // 2. Tranfer the collateral from the synthetic token to the liquidator
        // 3. Transfer a portion to the ARC Core contract as a fee

        D2Types.Position storage position = positions[positionId];

        require(
            position.owner != address(0),
            "liquidatePosition(): must be a valid position"
        );

        // Ensure that the position is not collateralized
        require(
            isCollateralized(position) == false,
            "liquidatePosition(): position is collateralised"
        );

        // Get the liquidation price of the asset (discount for liquidator)
        Decimal.D256 memory liquidationPrice = calculateLiquidationPrice();

        // Calculate how much the user is in debt by to be whole again at a discounted price
        (Amount.Principal memory liquidationCollateralDelta) = calculateCollateralDelta(
            position.collateralAmount,
            position.borrowedAmount.calculateAdjusted(borrowIndex),
            liquidationPrice
        );

        // Liquidate a slight bit more to ensure the user is guarded against futher price drops
        liquidationCollateralDelta.value = Decimal.mul(
            liquidationCollateralDelta.value,
            Decimal.add(
                liquidationUserFee,
                Decimal.one().value
            )
        );

        // Calculate how much collateral this is going to cost the liquidator
        // The sign is negative since we need to subtract from the liquidation delta
        // which is a negative sign and subtracting a negative will actually add it

        // Calculate the amount of collateral actually needed in order to perform this liquidation.
        // Since the liquidationUserFee is the penalty, by multiplying (1-fee) we can get the
        // actual collateral amount needed. We'll ultimately be adding this amount to the
        // liquidation delta (which is negative) to give us the profit amount.
        (Amount.Principal memory liquidatorCollateralCost) = Amount.Principal({
            sign: true,
            value: Decimal.mul(
                liquidationCollateralDelta.value,
                Decimal.sub(
                    Decimal.one(),
                    liquidationUserFee.value
                )
            )
        });

        // If the maximum they're down by is greater than their collateral, bound to the maximum
        if (liquidationCollateralDelta.value > position.collateralAmount.value) {
            liquidationCollateralDelta.value = position.collateralAmount.value;

            // If the the original collateral delta is to be the same as the
            // collateral amount. What this does is that the profit calculated
            // will be 0 since the liquidationCollateralDelta less the
            // originalCollateralDelta will be the same.
            liquidatorCollateralCost.value = position.collateralAmount.value;
        }

        // Calculate how much borrowed assets to liquidate (at a discounted price)
        // We can use the liquidationCollateralDelta.value since it's already using
        // interest-adjusted values rather than principal values
        uint256 borrowToLiquidate = Decimal.mul(
            liquidationCollateralDelta.value,
            liquidationPrice
        );

        // Decrease the user's debt amout by the principal amount
        position = setBorrowAmount(
            positionId,
            position.borrowedAmount.add(
                Amount.calculatePrincipal(
                    borrowToLiquidate,
                    borrowIndex,
                    true
                )
            )
        );

        // Decrease the user's collateral amount
        position = setCollateralAmount(
            positionId,
            position.collateralAmount.sub(liquidationCollateralDelta)
        );

        require(
            IERC20(collateralAsset).balanceOf(msg.sender) >= borrowToLiquidate,
            "liquidatePosition(): msg.sender not enough of borrowed asset to liquidate"
        );

        _settleLiquidation(
            borrowToLiquidate,
            liquidationCollateralDelta,
            liquidatorCollateralCost
        );
    }

    function _settleLiquidation(
        uint256 borrowToLiquidate,
        Amount.Principal memory liquidationCollateralDelta,
        Amount.Principal memory liquidatorCollateralCost
    )
        private
    {
        ISyntheticToken synthetic = ISyntheticToken(syntheticAsset);
        IERC20 collateralAsset = IERC20(collateralAsset);

        // Burn the synthetic asset from the liquidator
        synthetic.burn(
            msg.sender,
            borrowToLiquidate
        );

        // This is the actual profit collected from the liquidation
        // Since the liquidationCollateralDelta is negative and liquidationCollateralCost
        // is a positive value, by adding them the result gives us the profit
        Amount.Principal memory collateralProfit = liquidationCollateralDelta.add(
            liquidatorCollateralCost
        );

        // ARC's profit is simple a percentage of the profit, not net total
        uint256 arcProfit = Decimal.mul(
            collateralProfit.value,
            liquidationArcRatio
        );

        // Transfer them the collateral assets they acquired at a discount
        bool userTransferResult = synthetic.transferCollateral(
            address(collateralAsset),
            msg.sender,
            uint256(liquidationCollateralDelta.value).sub(arcProfit)
        );

        require(
            userTransferResult == true,
            "liquidate(): collateral failed to transfer to user"
        );

        // Transfer ARC the collateral asset acquired at a discount
        bool arcTransferResult = synthetic.transferCollateral(
            address(collateralAsset),
            address(this),
            arcProfit
        );

        require(
            arcTransferResult == true,
            "liquidate(): collateral failed to transfer to arc"
        );
    }

    function setCollateralAmount(
        uint256 positionId,
        Amount.Principal memory newSupplyAmount
    )
        internal
        returns (D2Types.Position storage)
    {
        D2Types.Position storage position = positions[positionId];

        if (position.collateralAmount.equals(newSupplyAmount)) {
            return position;
        }

        uint256 newTotalSupplied = totalSupplied;

        // Roll back the old amount
        newTotalSupplied = newTotalSupplied.sub(position.collateralAmount.value);

        // Roll forward the new amount
        newTotalSupplied = newTotalSupplied.add(newSupplyAmount.value);

        // Update the total borrowed storage value to the final result
        totalSupplied = newTotalSupplied;

        // Update the actual position's supplied amount
        position.collateralAmount = newSupplyAmount;

        return position;
    }

    function setBorrowAmount(
        uint256 positionId,
        Amount.Principal memory newBorrowAmount
    )
        internal
        returns (D2Types.Position storage)
    {
        D2Types.Position storage position = positions[positionId];
        Amount.Principal memory existingAmount = position.borrowedAmount;

        if (position.borrowedAmount.equals(newBorrowAmount)) {
            return position;
        }

        uint256 newTotalBorrowed = totalBorrowed;

        // Roll back the old amount
        newTotalBorrowed = newTotalBorrowed.sub(existingAmount.value);

        // Roll forward the new amount
        newTotalBorrowed = newTotalBorrowed.add(newBorrowAmount.value);

        // Update the total borrowed storage value to the final result
        totalBorrowed = newTotalBorrowed;

        // Update the actual position's borrowed amount
        position.borrowedAmount = newBorrowAmount;

        // Prevent having debt represented by positive values
        if (position.borrowedAmount.value == 0) {
            position.borrowedAmount.sign = false;
        }

        return position;
    }

    function currentTimestamp()
        public
        returns (uint256)
    {
        return block.timestamp;
    }

    /* ========== Public Getters ========== */

    function getPosition(
        uint256 id
    )
        public
        view
        returns (D2Types.Position memory)
    {
        return positions[id];
    }

    function getCurrentPrice()
        public
        view
        returns (Decimal.D256 memory)
    {
        return oracle.fetchCurrentPrice();
    }

    function getSyntheticAsset()
        external
        view
        returns (address)
    {
        return address(syntheticAsset);
    }

    function getCollateralAsset()
        external
        view
        returns (address)
    {
        return address(collateralAsset);
    }

    function getCurrentOracle()
        external
        view
        returns (address)
    {
        return address(oracle);
    }

    function getBorrowIndex()
        external
        view
        returns (uint256, uint256)
    {
        return (borrowIndex, indexLastUpdate);
    }

    function getCollateralRatio()
        external
        view
        returns (Decimal.D256 memory)
    {
        return collateralRatio;
    }

    function getTotals()
        external
        view
        returns (uint256, uint256)
    {
        return (totalSupplied, totalBorrowed);
    }

    function getLimits()
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (collateralLimit, syntheticLimit, positionCollateralMinimum);
    }

    function getInterestRate()
        external
        view
        returns (uint256)
    {
        return interestRate;
    }

    function getFees()
        external
        view
        returns (
            Decimal.D256 memory _liquidationUserFee,
            Decimal.D256 memory _liquidationArcRatio,
            Decimal.D256 memory _printerArcRatio
        )
    {
        return (
            liquidationUserFee,
            liquidationArcRatio,
            printerArcRatio
        );
    }

    /* ========== Developer Functions ========== */

    function isCollateralized(
        D2Types.Position memory position
    )
        public
        view
        returns (bool)
    {
        if (position.borrowedAmount.value == 0) {
            return true;
        }

        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        (Amount.Principal memory collateralDelta) = calculateCollateralDelta(
            position.collateralAmount,
            position.borrowedAmount.calculateAdjusted(borrowIndex),
            currentPrice
        );

        if (collateralDelta.value == 0) {
            collateralDelta.sign = true;
        }

        return collateralDelta.sign;
    }

    /**
     * @dev Calculate how much collateral you need given a certain borrow amount
     *
     * @param borrowedAmount The borrowed amount expressed as a uint256 (NOT principal)
     * @param price What price do you want to calculate the inverse at
     */
    function calculateCollateralRequired(
        uint256 borrowedAmount,
        Decimal.D256 memory price
    )
        public
        view
        returns (Amount.Principal memory)
    {

        uint256 inverseRequired = Decimal.div(
            borrowedAmount,
            price
        );

        inverseRequired = Decimal.mul(
            inverseRequired,
            collateralRatio
        );

        return Amount.Principal({
            sign: true,
            value: inverseRequired
        });
    }

    /**
     * @dev Given an asset being borrowed, figure out how much collateral can this still borrow or
     *      is in the red by. This function is used to check if a position is undercolalteralised and
     *      also to calculate how much can a position be liquidated by.
     *
     * @param parSupply The amount being supplied
     * @param borrowedAmount The non-par amount being borrowed
     * @param price The price to calculate this difference by
     */
    function calculateCollateralDelta(
        Amount.Principal memory parSupply,
        uint256 borrowedAmount,
        Decimal.D256 memory price
    )
        public
        view
        returns (Amount.Principal memory)
    {
        Amount.Principal memory collateralDelta;
        Amount.Principal memory collateralRequired;

        collateralRequired = calculateCollateralRequired(
            borrowedAmount,
            price
        );

        // If the amount of collateral needed exceeds the par supply amount
        // then the result will be negative indicating the position is undercollateralised.
        collateralDelta = parSupply.sub(collateralRequired);

        return collateralDelta;
    }

    /**
     * @dev When executing a liqudation, the price of the asset has to be calculated
     *      at a discount in order for it to be profitable for the liquidator. This function
     *      will get the current oracle price for the asset and find the discounted price.
     *
     */
    function calculateLiquidationPrice()
        public
        view
        returns (Decimal.D256 memory)
    {
        Decimal.D256 memory result;
        Decimal.D256 memory currentPrice = oracle.fetchCurrentPrice();

        result = Decimal.sub(
            Decimal.one(),
            liquidationUserFee.value
        );

        result = Decimal.mul(
            currentPrice,
            result
        );

        return result;
    }
}