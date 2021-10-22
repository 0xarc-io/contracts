// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IERC20} from "../../token/IERC20.sol";

contract IBadgerSett is IERC20 {

    function getPricePerFullShare()
        public
        view
        returns (uint256);

    function balance()
        public
        view
        returns (uint256);
}
