// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

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
