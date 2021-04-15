// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {SyntheticTokenV2} from "../synthetic/SyntheticTokenV2.sol";

contract MockSyntheticTokenV2 is SyntheticTokenV2 {

    function mint(
        address _to,
        uint256 _value
    )
        external
    {
        _mint(_to, _value);
    }
}
