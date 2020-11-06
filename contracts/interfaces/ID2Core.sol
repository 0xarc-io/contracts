// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {D2Types} from "../v2/D2Types.sol";
import {Decimal} from "../lib/Decimal.sol";
import {Amount} from "../lib/Amount.sol";

interface ID2Core {

    function getPosition(
        uint256 id
    )
        external
        view
        returns (D2Types.Position memory);

    function getCurrentPrice()
        external
        view
        returns (Decimal.D256 memory);

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

    function getInterestSetter()
        external
        view
        returns (address);

    function getBorrowIndex()
        external
        view
        returns (uint256, uint256);

    function getCollateralRatio()
        external
        view
        returns (Decimal.D256 memory);

    function getTotals()
        external
        view
        returns (uint256, uint256, Amount.Principal memory);

    function getLimits()
        external
        view
        returns (uint256, uint256, uint256);

    function getInterestRate()
        external
        view
        returns (uint256);

    function getFees()
        external
        view
        returns (
            Decimal.D256 memory _liquidationUserFee,
            Decimal.D256 memory _liquidationArcRatio
        );
}