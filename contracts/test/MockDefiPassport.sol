pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {DefiPassport} from "../token/erc721/DefiPassport.sol";

contract MockDefiPassport is DefiPassport {

    mapping(address => mapping(uint256 => address)) private _skinRecords;

    function _isSkinOwner(
        address _user,
        address _skin,
        uint256 _tokenId
    )
        internal
        view
        returns (bool)
    {
        return _skinRecords[_skin][_tokenId] == _user;
    }

    function setSkinOwner(
        address _skin,
        uint256 _tokenId,
        address _owner
    )
        external
    {
        _skinRecords[_skin][_tokenId] = _owner;
    }
}
