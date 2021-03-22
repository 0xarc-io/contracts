// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

import {ISapphireStrategy} from "./ISapphireStrategy.sol";

contract SapphireStrategy is ISapphireStrategy {

    /* ========== Events ========== */

    event Deposited(
        address _token,
        uint256 _amount,
        address _user,
        address _vault
    );

    event Withdrawn(
        address _token,
        uint256 _amount,
        address _user,
        address _vault
    );

    event Harvested(
        address _token,
        uint256 _amount,
        address _user
    );

    event Rescued(
        address _token,
        address _to,
        uint256 _amount,
        address _vault
    );

    /* ========== Public Functions ========== */

    function deposit(
        address _token,
        uint256 _amount,
        address _user,
        address _vault
    )
        public
        returns (uint256);

    function withdraw(
        address _token,
        address _to,
        uint256 _amount,
        address _vault
    )
        public
        returns (uint256);

    function harvest() public;

    function rescue(
        address _token,
        address _to,
        uint256 _amount,
        address _vault
    )
        public
        returns (uint256);
}
