// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IERC20} from "../../token/IERC20.sol";

abstract contract IBadgerSett is IERC20 {

    function getPricePerFullShare()
        public
        view
        virtual
        returns (uint256);

    function balance()
        public
        view
        virtual
        returns (uint256);
}
