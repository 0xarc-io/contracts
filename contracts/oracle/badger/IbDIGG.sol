// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

import {IERC20} from "../../token/IERC20.sol";

contract IbDIGG is IERC20 {

    function getPricePerFullShare()
        public
        view
        returns (uint256);
}
