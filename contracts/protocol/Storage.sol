pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {Types} from "../lib/Types.sol";
import {SyntheticToken} from "../token/SyntheticToken.sol";

contract Storage {

    // ============ Variables ============

    Types.GlobalParams public params;
    Types.State public state;
    Types.Exchange public exchange;

    SyntheticToken public synthetic;

    uint256 public positionCount;

    mapping(uint256 => Types.Position) public positions;

    mapping (address => uint256) public liquidityBalances;
    mapping (address => uint256) public supplyBalances;
}
