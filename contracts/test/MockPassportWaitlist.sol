// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {PassportWaitlist} from "../global/PassportWaitlist.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockPassportWaitlist is PassportWaitlist, MockTimestamp {

    constructor(
        address _paymentToken,
        uint256 _paymentAmount,
        address payable _paymentReceiver
    )
        public
        PassportWaitlist(
            _paymentToken,
            _paymentAmount,
            _paymentReceiver
        )
    {/* solium-disable-line no-empty-blocks */}
}
