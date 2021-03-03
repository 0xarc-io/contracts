// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {ISapphireMapper} from "./ISapphireMapper.sol";
import {SafeMath} from "../../lib/SafeMath.sol";

contract SapphireMapperLinear is ISapphireMapper {
    using SafeMath for uint256;

    /**
     * @notice An inverse linear mapper.
     * Returns `_upperBound - (_score/_scoreMax) * (upperBound - lowerBound)`
     *
     * @param _score The score to check for
     * @param _scoreMax The maximum score
     * @param _lowerBound The mapping lower bound
     * @param _upperBound The mapping upper bound
     */
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
        require(
            _scoreMax > 0 &&
            _upperBound > 0,
            "The maximum score and upper bound cannot be 0"
        );

        require(
            _lowerBound < _upperBound,
            "The upper bound cannot be equal or larger than the lower bound"
        );

        require(
            _score <= _scoreMax,
            "The score cannot be larger than the maximum score"
        );

        uint256 BASE = 10 ** 18;

        uint256 boundsDifference = _upperBound.sub(_lowerBound);

        return _upperBound
            .sub(
                _score
                    .mul(BASE)
                    .mul(boundsDifference)
                    .div(_scoreMax)
                    .div(BASE)
            );
    }

}
