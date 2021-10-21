// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

interface ISapphireOracle {

    /**
     * @notice Fetches the current price of the asset
     *
     * @return The price in 18 decimals and the timestamp when
     *         the price was updated and the decimals of the asset
     */
    function fetchCurrentPrice()
        external
        view
        returns (uint256 price, uint256 timestamp);
}
