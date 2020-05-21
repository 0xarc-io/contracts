pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import {Types} from "../lib/Types.sol";


contract Storage {

    // ============ Variables ============

    Types.GlobalParams params;
    Types.State state;
    Types.Exchange exchange;

    mapping(uint256 => Types.Position) positions;
}
