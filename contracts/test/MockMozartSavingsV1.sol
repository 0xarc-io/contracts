// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {MozartSavingsV1} from "../debt/mozart/MozartSavingsV1.sol";
import {Decimal} from "../lib/Decimal.sol";

contract MockMozartSavingsV1 is MozartSavingsV1 {

    uint256 private _currentTimestamp = 0;

    constructor(
        address _coreAddress,
        address _accrualToken,
        address _feeDestination,
        Decimal.D256 memory _fee
    )
        MozartSavingsV1(
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
