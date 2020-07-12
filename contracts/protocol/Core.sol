pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {console} from "@nomiclabs/buidler/console.sol";
import {SyntheticToken} from "../token/SyntheticToken.sol";

import {Types} from "../lib/Types.sol";
import {Interest} from "../lib/Interest.sol";

import {Operation} from "./Operation.sol";
import {Getters} from "./Getters.sol";

contract Core is Operation, Getters {

    // ============ Constructor ============

    constructor(
        string memory name,
        string memory symbol,
        Types.GlobalParams memory _globalParams
    )
        public
    {
        console.log('** ARC Deployed **');

        g_state.params = _globalParams;
        g_state.synthetic = new SyntheticToken(name, symbol, address(this));
        g_state.index = Interest.newIndex();

    }
}
