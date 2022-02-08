// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SapphirePool} from "../sapphire/SapphirePool/SapphirePool.sol";

contract MockSapphirePool is SapphirePool {
    function tokenDecimals(address _token)
        external
        view
        returns (uint8)
    {
        return _tokenDecimals[_token];    
    }

     function getScaledAmount(
        uint256 _amount,
        uint8 _decimalsIn,
        uint8 _decimalsOut
    ) 
        external
        pure
        returns (uint256)
    {
        return _getScaledAmount(_amount, _decimalsIn, _decimalsOut);
    }
}
