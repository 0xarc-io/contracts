// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../../lib/Decimal.sol";
import {SafeMath} from "../../lib/SafeMath.sol";

import {IERC20} from "../../token/IERC20.sol";
import {IOracle} from "../IOracle.sol";
import {IChainLinkAggregator} from "../IChainLinkAggregator.sol";
import {IWstETH} from "./IWstETH.sol";
import {ICurve} from "../ICurve.sol";


contract WstEthOracle is IOracle {
    using SafeMath for uint256;

    IChainLinkAggregator public chainLinkEthAggregator = IChainLinkAggregator(
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
    );

    address public stETHCrvPoolAddress = 0xDC24316b9AE028F1497c275EB9192a3Ea0f67022;

    // TODO add the wstETH address on mainnet. This given address (0xDC24316b9AE028F1497c275EB9192a3Ea0f67022) is wrong
    address public wstETHAddress = 0xDC24316b9AE028F1497c275EB9192a3Ea0f67022;

    uint256 public chainlinkEthScalar;

    constructor() public {
        chainlinkEthScalar = uint256(18 - chainLinkEthAggregator.decimals());
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        // get stETH per wstETH
        uint256 stEthPerWstEth = IWstETH(wstETHAddress).stEthPerToken();

        // get price of stETH in ETH
        uint256 ethPerStEth = ICurve(stETHCrvPoolAddress).get_virtual_price();

        // get price in USD
        uint256 usdPerEth = uint256(chainLinkEthAggregator.latestAnswer()).mul(10 ** chainlinkEthScalar);

        uint256 ethPerWstEth = stEthPerWstEth.mul(ethPerStEth).div(10 ** 18);

        uint256 usdPerWstEth = usdPerEth.mul(ethPerWstEth).div(10 ** 18);

        require(
            usdPerWstEth > 0,
            "WstEthOracle: cannot report a price of 0"
        );

        return Decimal.D256({
            value: usdPerWstEth
        });
    }
}
