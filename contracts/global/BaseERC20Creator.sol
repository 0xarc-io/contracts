// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {BaseERC20} from "../token/BaseERC20.sol";

contract BaseERC20Creator {

    event TokenDeployed(address _token);

    /**
     * @dev Deploy a new token on mainnet
     *
     * @param name The name of the token to deploy
     * @param symbol The symbol of the token to deploy
     */
    function deploy(
        string memory name,
        string memory symbol,
        uint8         decimals
    )
        public
        returns (address)
    {
        BaseERC20 token = new BaseERC20(name, symbol, decimals);
        emit TokenDeployed(address(token));
        return address(token);
    }

}
