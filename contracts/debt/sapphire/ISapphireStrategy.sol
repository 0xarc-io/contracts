// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

interface ISapphireStrategy {

    function deposit(
        address _token,
        uint256 _amount,
        address _user,
        address _vault
    )
        external
        returns (uint256);

    function withdraw(
        address _token,
        uint256 _amount,
        address _user,
        address _vault
    )
        external
        returns (uint256);

    function harvest()
        external;

    function rescue(
        address _token,
        address _to,
        uint256 _amount,
        address _vault
    )
        external
        returns (uint256);

}
