// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

import {ISyntheticToken} from "../interfaces/ISyntheticToken.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Interest} from "../lib/Interest.sol";
import {Types} from "../lib/Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Math} from "../lib/Math.sol";
import {SignedMath} from "../lib/SignedMath.sol";

import {BaseERC20} from "./BaseERC20.sol";

contract SyntheticToken is BaseERC20, ISyntheticToken {

    using Types for Types.Par;
    using Types for Types.Wei;
    using Math for uint256;
    using SafeMath for uint256;

    // ============ Variable ============

    address public arcAddress;

    // ============ Constructor ============

    constructor(
         address _arcAddress,
        string memory _name,
        string memory _symbol
    ) public BaseERC20(_name, _symbol) {
        arcAddress = _arcAddress;
    }

    // ============ Core Functions ============

    function mint(
        address to,
        uint256 value
    )
        public
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
    {
        BaseERC20(token).transfer(
            to,
            value
        );
    }

}
