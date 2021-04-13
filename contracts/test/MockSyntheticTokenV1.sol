// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SyntheticTokenV1} from "../synthetic/SyntheticTokenV1.sol";

contract MockSyntheticTokenV1 is SyntheticTokenV1 {
    
    function mint(
        address _to,
        uint256 _value
    )
        external
    {
        _mint(_to, _value);
    }
}
