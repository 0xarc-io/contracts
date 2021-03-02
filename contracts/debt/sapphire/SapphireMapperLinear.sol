// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {ISapphireMapper} from "./ISapphireMapper.sol";

contract SapphireMapperLinear is ISapphireMapper {

    function map(
        uint256 _score,
        uint256 _scoreMax,
        uint256 _lowerBound,
        uint256 _upperBound
    )
        public
        view
        returns (uint256)
    {
        // Sort the two vars, highest first
        // Map linearly
        // Return the result
        return 0;
    }

}
