// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {IPermittableERC20} from "../token/IPermittableERC20.sol";

contract PassportWaitlist is Ownable {

    /* ========== Events ========== */

    event UserApplied(
        address indexed _user,
        address _paymentToken,
        uint256 _paymentAmount,
        uint256 _timestamp
    );

    event PaymentSet(
        address _paymentToken,
        uint256 _paymentAmount,
        address _paymentReceiver
    );

    /* ========== Storage ========== */

    IPermittableERC20 public paymentToken;
    uint256           public paymentAmount;
    address payable   public paymentReceiver;

    constructor(
        address _paymentToken,
        uint256 _paymentAmount,
        address payable _paymentReceiver
    ) public {
        setPayment(
            _paymentToken,
            _paymentAmount,
            _paymentReceiver
        );
    }

    /* ========== Admin ========== */

    function setPayment(
        address _paymentToken,
        uint256 _paymentAmount,
        address payable _paymentReceiver
    )
        public
        onlyOwner
    {
        require(
            _paymentAmount > 0,
            "PassportWaitlist: the payment amount must be higher than 0"
        );

        require(
            _paymentReceiver != address(0),
            "PassportWaitlist: payment receiver cannot be address 0"
        );

        paymentToken    = IPermittableERC20(_paymentToken);
        paymentAmount   = _paymentAmount;
        paymentReceiver = _paymentReceiver;

        emit PaymentSet(
            address(paymentToken),
            paymentAmount,
            paymentReceiver
        );
    }

    /* ========== Public Functions ========== */

    /**
     * @notice Pays the fee and signs up for the passport. This action is only recorded at the logs level and not in the storage.
     */
    function applyForPassport() public
    {
        SafeERC20.safeTransferFrom(
            paymentToken,
            msg.sender,
            paymentReceiver,
            paymentAmount
        );

        emit UserApplied(
            msg.sender,
            address(paymentToken),
            paymentAmount,
            currentTimestamp()
        );
    }

    /**
     * @notice Same as `applyForPassport()` but with a permit to avoid making 2 transactions
     */
    function permitApplyForPassport (
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    )
        external
    {
        paymentToken.permit(
            msg.sender,
            address(this),
            paymentAmount,
            _deadline,
            _v,
            _r,
            _s
        );
        applyForPassport();
    }

    function payableApplyForPassport()
        public
        payable
    {
        require(
            address(paymentToken) == address(0),
            "PassportWaitlist: the payment is an erc20"
        );

        require(
            msg.value == paymentAmount,
            "PassportWaitlist: wrong payment amount"
        );

        paymentReceiver.transfer(msg.value);

        emit UserApplied(
            msg.sender,
            address(0),
            paymentAmount,
            currentTimestamp()
        );
    }

    /* ========== Dev Functions ========== */

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }
}
