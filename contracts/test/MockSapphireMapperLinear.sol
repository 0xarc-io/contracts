pragma solidity 0.8.9;

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
        uint256 _score,
        uint256 _scoreMax,
        uint256 _lowerBound,
        uint256 _upperBound
    )
        public
        view
        returns (uint256)
    {
        return _mapResult;
    }
}
