// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IERC20} from "./IERC20.sol";

import {Amount} from "../lib/Amount.sol";

interface ISyntheticTokenV2 {

    function mint(
        address to,
        uint256 value
    )
        external;
    
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    )
        external
        returns (bool);

    function destroy(
        uint256 _value
    )
        external;

}
