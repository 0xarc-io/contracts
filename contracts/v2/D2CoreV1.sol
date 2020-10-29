// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {IMintableToken} from "../interfaces/IMintableToken.sol";
import {IOracle} from "../interfaces/IOracle.sol";

import {Adminable} from "../lib/Adminable.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Math} from "../lib/Math.sol";

import {D2Storage} from "./D2Storage.sol";
import {D2Types} from  "./D2Types.sol";

contract D2CoreV1 is Adminable, D2Storage {

    /* ========== Libraries ========== */

    using SafeMath for uint256;
    using Math for uint256;

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

    constructor() public {
        paused = true;
    }

    /* ========== Modifiers ========== */

    modifier isAuthorisedOperator(D2Types.Position memory position) {
        _;
    }

    /* ========== Admin Setters ========== */

    function setOracle(
        address _oracle
    )
        public
        onlyAdmin
    {

    }

    function setCollateralRatio(
        Decimal.D256 memory _collateralRatio
    )
        public
        onlyAdmin
    {

    }

    function setLiquidationFees(
        Decimal.D256 memory _liquidationUserFee
    )
        public
        onlyAdmin
    {

    }

    function setLimits(
        uint256 _collateralLimit,
        uint256 _syntheticLimit,
        uint256 _positionCollateralMinimum
    )
        public
        onlyAdmin
    {

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

    }

    /**
     * @dev Repay money against a borrowed position. When this process occurs the position's
     *      debt will be reduced and in turn will allow them to withdraw their collateral should they choose.
     *
     * @param positionId ID of the position to repay
     * @param repayAmount Amount of collateral to repay
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

}