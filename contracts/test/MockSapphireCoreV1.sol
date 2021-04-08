// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {IOracle} from "../oracle/IOracle.sol";

import {SapphireCoreV1} from "../debt/sapphire/SapphireCoreV1.sol";
import {MockTimestamp} from "./MockTimestamp.sol";

contract MockSapphireCoreV1 is MockTimestamp, SapphireCoreV1 {
    function setOracle(
        address _oracle
    )
        public
    {
        oracle = IOracle(_oracle);
    }

    function setCollateralRatioAssessor(
        address _assessor
    )
        public
    {
        collateralRatioAssessor = _assessor;
    }
}
