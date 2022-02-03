// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SapphirePool} from "../sapphire/SapphirePool/SapphirePool.sol";

contract MockSapphirePool is SapphirePool {
    function tokenScalars(address _token)
        external
        view
        returns (uint8)
    {
        return _tokenScalars[_token];    
    }
}
