pragma solidity 0.5.16;

import {SapphireMapperLinear} from "../debt/sapphire/SapphireMapperLinear.sol";

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
