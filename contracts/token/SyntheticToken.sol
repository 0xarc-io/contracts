pragma solidity ^0.6.8;

import {BaseERC20} from "./BaseERC20.sol";
import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";

contract SyntheticToken is BaseERC20, ISyntheticToken {

    // ============ Variable ============

    address public arcAddress;

    // ============ Constructor ============

    constructor(
        string memory _name,
        string memory _symbol,
        address _arcAddress
    ) public BaseERC20(_name, _symbol) {
        arcAddress = _arcAddress;
    }

    // ============ Functions ============

    function mint(
        address to,
        uint256 value
    )
        public
        override
    {
        require(
            msg.sender == arcAddress,
            "SyntheticToken: only arc can mint"
        );

        _mint(to, value);
    }

    function burn(
        address to,
        uint256 value
    )
        public
        override
    {
        require(
            msg.sender == arcAddress,
            "SyntheticToken: only arc can burn"
        );

        _burn(to, value);
    }

    function transferCollateral(
        address token,
        address to,
        uint256 value
    )
        public
        override
    {
        BaseERC20(token).transfer(
            to,
            value
        );
    }
}
