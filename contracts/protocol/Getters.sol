pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {State} from "./State.sol";

import {Storage} from "../lib/Storage.sol";
import {Interest} from "../lib/Interest.sol";
import {Types} from "../lib/Types.sol";

contract Getters is State {

    using Storage for Storage.State;

    // ============ Functions ============

    // function getIndex()
    //     public
    //     view
    //     returns (Interest.Index memory)
    // {
    //     return g_state.index;
    // }

    // function getTotalPar()
    //     public
    //     view
    //     returns (Types.TotalPar memory)
    // {
    //     return g_state.totalPar;
    // }

    function getPosition(
        uint256 positionId
    )
        public
        view
        returns (Types.Position memory)
    {
        return g_state.positions[positionId];
    }

    function getSynthetic()
        public
        view
        returns (address)
    {
        return address(g_state.synthetic);
    }

    function getStable()
        public
        view
        returns (address)
    {
        return address(g_state.params.stableAsset);
    }

//     function getGlobalParams()
//         public
//         view
//         returns (Types.GlobalParams memory)
//     {
//         return g_state.params;
//     }
}
