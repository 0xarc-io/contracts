// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {D2Types} from "../v2/D2Types.sol";

import {Decimal} from "../lib/Decimal.sol";

interface ID2Core {

    function getSyntheticAsset()
        external
        view
        returns (address);

    function getCollateralAsset()
        external
        view
        returns (address);

    function getCurrentOracle()
        external
        view
        returns (address);

    function getBorrowIndex()
        external
        view
        returns (uint256);

    function getLastIndexUpdate()
        external
        view
        returns (uint256);

    function getPosition(
        uint256 positionId
    )
        external
        view
        returns (D2Types.Position memory);

    function getCollateralRatio()
        external
        view
        returns (Decimal.D256 memory);

    function getTotalSupplied()
        external
        view
        returns (uint256);

    function getTotalBorrowed()
        external
        view
        returns (uint256);
}