// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import {Decimal} from "../../lib/Decimal.sol";
import {SafeMath} from "../../lib/SafeMath.sol";
import {BaseERC20} from "../../token/BaseERC20.sol";

import {IOracle} from "../IOracle.sol";
import {IChainLinkAggregator} from "../chainlink/IChainLinkAggregator.sol";

import {IBadgerSett} from "./IBadgerSett.sol";

/* solhint-disable-next-line */
contract bDIGGOracle is IOracle {

    using SafeMath for uint256;

    IBadgerSett public bDIGG = IBadgerSett(0x7e7E112A68d8D2E221E11047a72fFC1065c38e1a);
    BaseERC20 public DIGG = BaseERC20(0x798D1bE841a82a273720CE31c822C61a67a601C3);

    IChainLinkAggregator public diggBtcChainlinkOracle = IChainLinkAggregator(
        0x418a6C98CD5B8275955f08F0b8C1c6838c8b1685
    );

    IChainLinkAggregator public btcUsdChainlinkOracle = IChainLinkAggregator(
        0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
    );

    uint256 public diggBtcChainlinkScalar;
    uint256 public btcUsdChainlinkScalar;
    uint256 public diggScalar;

    constructor() public {
        diggBtcChainlinkScalar = uint256(18 - diggBtcChainlinkOracle.decimals());
        btcUsdChainlinkScalar = uint256(18 - btcUsdChainlinkOracle.decimals());

        diggScalar = uint256(18 - DIGG.decimals());
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        uint256 totalDiggInbDigg = bDIGG.balance().mul(10 ** diggScalar);
        uint256 diggPerbDigg = totalDiggInbDigg.mul(10 ** 18).div(bDIGG.totalSupply());

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
