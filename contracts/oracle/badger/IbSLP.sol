// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

import {IBadgerSett} from "./IBadgerSett.sol";

contract IbSLP is IBadgerSett {

    function token()
        public
        view
        returns (address);
}
