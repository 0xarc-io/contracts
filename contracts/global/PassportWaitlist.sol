// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {Address} from "../lib/Address.sol";
import {SafeERC20} from "../lib/SafeERC20.sol";
import {IPermittableERC20} from "../token/IPermittableERC20.sol";

contract PassportWaitlist is Ownable {

    /* ========== Libraries ========== */

    using Address for address;
    
    /* ========== Events ========== */

    event UserApplied(
        address _user,
        address _paymentToken,
        uint256 _paymentAmount,
        uint256 _timestamp
    );

    /* ========== Storage ========== */

    IPermittableERC20 public paymentToken;
    uint256           public paymentAmount;
    address           public paymentReceiver;

    constructor(
        address _paymentToken,
        uint256 _paymentAmount,
        address _paymentReceiver
    ) public {
        require(
            _paymentToken.isContract(),
            "PassportWaitlist: payment token is not a contract"
        );

        require(
            _paymentAmount > 0,
            "PassportWaitlist: payment amount must be greater than 0"
        );

        require(
            _paymentReceiver != address(0),
            "PassportWaitlist: payment receiver cannot be address 0"
        );

        paymentToken    = IPermittableERC20(_paymentToken);
        paymentAmount   = _paymentAmount;
        paymentReceiver = _paymentReceiver;
    }

    /* ========== Public Functions ========== */

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

    /* ========== Dev Functions ========== */

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return block.timestamp;
    }
}
