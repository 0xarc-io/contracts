// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

interface ICurveZapDeposit {
    function calc_token_amount(
        address,
        uint256[4] calldata,
        bool
    ) external view returns (uint256);

    function calc_withdraw_one_coin(
        address,
        uint256,
        int128
    ) external view returns (uint256);

    function add_liquidity(
        address,
        uint256[4] calldata,
        uint256
    ) external returns (uint256);

    function remove_liquidity_one_coin(
        address,
        uint256,
        int128,
        uint256
    ) external returns (uint256);
}
