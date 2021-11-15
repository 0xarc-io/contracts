// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {DefiPassport} from "../token/erc721/DefiPassport.sol";

contract MockDefiPassport is DefiPassport {

    function burn (uint256 tokenId) external {
        _burn(tokenId);
    }
}
