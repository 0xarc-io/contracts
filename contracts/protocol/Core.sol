pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {console} from "@nomiclabs/buidler/console.sol";

import {Types} from "../lib/Types.sol";
import {BaseERC20} from "../token/BaseERC20.sol";

import {Admin} from "./Admin.sol";
import {Storage} from "./Storage.sol";
import {Actions} from "./Actions.sol";

contract Core is Admin, Storage, Actions, BaseERC20 {

    // ============ Constructor ============

    constructor(
        string memory name,
        string memory symbol,
        Types.GlobalParams memory _globalParams
    )
        BaseERC20(name, symbol)
        public
    {
        console.log('** ARC Deployed **');

        params = _globalParams;

    }
}
