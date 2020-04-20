pragma solidity ^0.6.6;

import "@nomiclabs/buidler/console.sol";

import {Admin} from "./Admin.sol";
import {Getters} from "./Getters.sol";

import {Storage} from "./lib/Storage.sol";
import {Actions} from "./lib/Actions.sol";


contract Arc {
    Storage.State state;

    function operate(Actions.ActionArg action) public {}
}
