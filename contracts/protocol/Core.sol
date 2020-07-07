pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {console} from "@nomiclabs/buidler/console.sol";
import {SyntheticToken} from "../token/SyntheticToken.sol";

import {Types} from "../lib/Types.sol";
import {Interest} from "../lib/Interest.sol";

import {Admin} from "./Admin.sol";
import {Actions} from "./Actions.sol";
import {Getters} from "./Getters.sol";

contract Core is Admin, Actions, Getters {

    // ============ Constructor ============

    constructor(
        string memory name,
        string memory symbol,
        Types.GlobalParams memory _globalParams
    )
        public
    {
        console.log('** ARC Deployed **');

        params = _globalParams;
        synthetic = new SyntheticToken(name, symbol, address(this));
        state.index = Interest.newIndex();

    }
}
