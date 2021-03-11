// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../../lib/Decimal.sol";
import {SafeMath} from "../../lib/SafeMath.sol";
import {BaseERC20} from "../../token/BaseERC20.sol";

import {IOracle} from "../IOracle.sol";
import {IChainLinkAggregator} from "../IChainLinkAggregator.sol";

import {IbDIGG} from "./IbDIGG.sol";

contract bDIGGOracle is IOracle {

    using SafeMath for uint256;

    IbDIGG public bDIGG = IbDIGG(0x7e7E112A68d8D2E221E11047a72fFC1065c38e1a);
    BaseERC20 public DIGG = BaseERC20(0x798D1bE841a82a273720CE31c822C61a67a601C3);

    IChainLinkAggregator public diggBtcChainlinkOracle = IChainLinkAggregator(
        0x418a6C98CD5B8275955f08F0b8C1c6838c8b1685
    );

    IChainLinkAggregator public btcUsdChainlinkOracle = IChainLinkAggregator(
        0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
    );

    uint256 public diggBtcChainlinkScalar;
    uint256 public btcUsdChainlinkScalar;

    constructor() public {
        diggBtcChainlinkScalar = uint256(18 - diggBtcChainlinkOracle.decimals());
        btcUsdChainlinkScalar = uint256(18 - btcUsdChainlinkOracle.decimals());
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        uint256 diggPerbDigg = bDIGG.getPricePerFullShare();

        uint256 btcPerDigg = uint256(
            diggBtcChainlinkOracle.latestAnswer()
        ).mul(10 ** diggBtcChainlinkScalar);

        uint256 usdPerBtc = uint256(
            btcUsdChainlinkOracle.latestAnswer()
        ).mul(10 ** btcUsdChainlinkScalar);

        uint256 btcPerbDigg = diggPerbDigg.mul(btcPerDigg).div(10 ** 18);

        uint256 usdPerbDigg = btcPerbDigg.mul(usdPerBtc).div(10 ** 18);

        require (
            usdPerbDigg > 0,
            "bDIGGOracle: cannot report a price of 0"
        );

        return Decimal.D256({
            value: usdPerbDigg
        });
    }
}
