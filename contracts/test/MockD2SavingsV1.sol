// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {D2SavingsV1} from "../v2/D2SavingsV1.sol";
import {Decimal} from "../lib/Decimal.sol";

contract MockD2SavingsV1 is D2SavingsV1 {

    uint256 private _currentTimestamp = 0;

    constructor(
        address _coreAddress,
        address _accrualToken,
        address _feeDestination,
        Decimal.D256 memory _fee
    )
        D2SavingsV1(
            _coreAddress,
            _accrualToken,
            _feeDestination,
            _fee
        )
        public
    { }

    function setCurrentTimestamp(uint256 _timestamp)
        public
    {
        _currentTimestamp = _timestamp;
    }

    function currentTimestamp()
        public
        view
        returns (uint256)
    {
        return _currentTimestamp;
    }
}