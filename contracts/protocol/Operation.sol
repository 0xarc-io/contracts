pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {console} from "@nomiclabs/buidler/console.sol";

import {Types} from "../lib/Types.sol";
import {Action} from "../lib/Action.sol";
import {Storage} from "../lib/Storage.sol";

import {State} from "./State.sol";

contract Operation is State {

    using Storage for Storage.State;

    // ============ Functions ============

    function operate(
        Action.Operation operation,
        Action.OperationParams memory params
    )
        public
    {
        Action.operateAction(
            g_state,
            operation,
            params
        );
    }

}
