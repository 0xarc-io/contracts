// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SapphireMapperLinear} from "../sapphire/SapphireMapperLinear.sol";

contract MockSapphireMapperLinear is SapphireMapperLinear {
    uint256 private _mapResult;

    function setMapResult(
        uint256 _result
    )
        public
    {
        _mapResult = _result;
    }

    function map(
        uint256,
        uint256,
        uint256,
        uint256
    )
        public
        view
        override
        returns (uint256)
    {
        return _mapResult;
    }
}
