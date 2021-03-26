// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

import {IERC20} from "../../token/IERC20.sol";

contract ISLP is IERC20 {

    function token0()
        public
        view
        returns (address);

    function token1()
        public
        view
        returns (address);

    function getReserves()
        public
        view
        returns (uint112, uint112, uint32);
}
