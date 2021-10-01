// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Ownable} from "../lib/Ownable.sol";
import {Address} from "../lib/Address.sol";
import {IPermittableERC20} from "../token/IPermittableERC20.sol";

contract PassportWaitlist is Ownable {

    /* ========== Libraries ========== */

    using Address for address;
    
    /* ========== Events ========== */
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

        paymentToken    = IPermittableERC20(_paymentToken);
        paymentAmount   = _paymentAmount;
        paymentReceiver = _paymentReceiver;
    }
}
