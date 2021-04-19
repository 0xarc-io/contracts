// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {SyntheticTokenV2} from "../synthetic/SyntheticTokenV2.sol";

contract MockSyntheticTokenV2 is SyntheticTokenV2 {

    constructor(
        string memory _name,
        string memory _version
    )
        SyntheticTokenV2(_name, _version)
        public
    { }


    function mint(
        address _to,
        uint256 _value
    )
        external
    {
        _mint(_to, _value);
    }
}
