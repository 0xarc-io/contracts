// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {PassportWaitlist} from "../global/PassportWaitlist.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockPassportWaitlist is PassportWaitlist, MockTimestamp {

    constructor(
        address _paymentToken,
        uint256 _paymentAmount,
        address payable _paymentReceiver
    )
        PassportWaitlist(
            _paymentToken,
            _paymentAmount,
            _paymentReceiver
        )
    {} // solhint-disable-line

    function currentTimestamp()
        public
        view
        override(PassportWaitlist, MockTimestamp)
        returns (uint256)
    {
        return MockTimestamp.currentTimestamp();
    }
}
