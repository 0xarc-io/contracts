pragma solidity ^0.6.6;
pragma experimental ABIEncoderV2;

import "@nomiclabs/buidler/console.sol";

import {Types} from "../lib/Types.sol";

import {Admin} from "./Admin.sol";
import {Storage} from "./Storage.sol";
import {Actions} from "./Actions.sol";


contract Arc is Admin, Storage, Actions {
    // ============ Constructor ============

    constructor(Types.GlobalParams memory _globalParams) public {}
}
