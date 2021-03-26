// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;

pragma experimental ABIEncoderV2;

import {SafeMath} from "../../lib/SafeMath.sol";
import {Decimal} from "../../lib/Decimal.sol";
import {BaseERC20} from "../../token/BaseERC20.sol";

import {IOracle} from "../IOracle.sol";
import {IChainLinkAggregator} from "../IChainLinkAggregator.sol";

import {ISett} from "./ISett.sol";
import {ISLP} from "./ISLP.sol";

/* solium-disable-next-line */
contract bWBTCBadgerSLPOracle is IOracle {

    using SafeMath for uint256;

    uint256 constant BASE = 10**18;

    ISett public bSLP = ISett(
        0x1862A18181346EBd9EdAf800804f89190DeF24a5
    );

    BaseERC20 public wbtc = BaseERC20(
        0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
    );

    BaseERC20 public badger = BaseERC20(
        0x3472A5A71965499acd81997a54BBA8D852C6E53d
    );

    IChainLinkAggregator public btcUsdChainlinkAggregator = IChainLinkAggregator(
        0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c
    );

    IChainLinkAggregator public ethUsdChainlinkAggregator = IChainLinkAggregator(
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
    );

    IChainLinkAggregator public badgerEthChainlinkAggregator = IChainLinkAggregator(
        0x58921Ac140522867bf50b9E009599Da0CA4A2379
    );

    ISLP public slp;

    uint256 slpScalar;
    uint256 wbtcScalar;
    uint256 badgerScalar;

    uint256 btcChainlinkScalar;
    uint256 ethChainlinkScalar;
    uint256 badgerChainlinkScalar;

    constructor() public {
        slp = ISLP(bSLP.token());

        wbtcScalar = uint256(18 - wbtc.decimals());
        badgerScalar = uint256(18 - badger.decimals());

        btcChainlinkScalar = uint256(18 - btcUsdChainlinkAggregator.decimals());
        ethChainlinkScalar = uint256(18 - ethUsdChainlinkAggregator.decimals());
        badgerChainlinkScalar = uint256(18 - badgerEthChainlinkAggregator.decimals());
    }

    /**
     * @dev Fetches the "fair" (flash-loan resistant) price according to the formula
     * described at https://blog.alphafinance.io/fair-lp-token-pricing/
     *
     * P = 2 * (sqrt(r0 * r1 * p0 * p1) / totalSupply)
     */
    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        // Get the WBTC and Badger reserves per SLP
        (uint256 resWBTC, uint256 resBadger) = _getReservesPerSLP();

        uint256 k = resWBTC.mul(resBadger);

        (uint256 usdPerBtc, uint256 usdPerBadger) = _getTokenPrices();

        uint256 totalSupply = slp.totalSupply().mul(10 ** slpScalar);

        uint256 fairSLPPrice = _computeFairPrice(
            k,
            usdPerBtc,
            usdPerBadger,
            totalSupply
        );

        require(
            fairSLPPrice > 0,
            "bWBTCBadgerSLPOracle: the reported price cannot be 0"
        );


        // Multiply the price by the number of slp per bSLP to
        // reflect the amount of SLP tokens per bSLP
        uint256 slpPerbSLP = bSLP.getPricePerFullShare().mul(10 ** slpScalar);
        uint256 fairbSLPPrice = fairSLPPrice.mul(slpPerbSLP).div(BASE);

        return Decimal.D256({
            value: fairbSLPPrice
        });
    }

    /* ========== Helper functions ========== */

    /**
     * @dev Fetches the WBTC and Badger reserves normalized to 10e18
     */
    function _getReservesPerSLP()
        private
        view
        returns (uint256, uint256)
    {
        (uint112 resWBTC112, uint112 resBadger112,) = slp.getReserves();

        require(
            resWBTC112 > 0 && resBadger112 > 0,
            "bWBTCBadgerSLPOracle: the reserves cannot be 0"
        );

        uint256 resWBTC = uint256(resWBTC112).mul(10 ** wbtcScalar);
        uint256 resBadger = uint256(resBadger112).mul(10 ** badgerScalar);

        return (resWBTC, resBadger);
    }

    /**
     * @dev Returns the BTC and Badger token prices in USD, normalized
     * to 10e18
     */
    function _getTokenPrices()
        private
        view
        returns (uint256, uint256)
    {
        uint256 usdPerBtc = uint256(
            btcUsdChainlinkAggregator.latestAnswer()
        ).mul(10 ** btcChainlinkScalar);

        uint256 ethPerBadger = uint256(
            badgerEthChainlinkAggregator.latestAnswer()
        ).mul(10 ** badgerChainlinkScalar);

        uint256 usdPerEth = uint256(
            ethUsdChainlinkAggregator.latestAnswer()
        ).mul(10 ** ethChainlinkScalar);

        uint256 usdPerBadger = ethPerBadger.mul(usdPerEth).div(BASE);

        require(
            usdPerBtc > 0 && usdPerBadger > 0,
            "bWBTCBadgerSLPOracle: the usd prices of badger and btc cannot be 0"
        );

        return (usdPerBtc, usdPerBadger);
    }

    /**
     * @dev Computes the fair price using the reserves product K,
     * token prices and total supply
     */
    function _computeFairPrice(
        uint256 _k,
        uint256 _usdPerBtc,
        uint256 _usdPerBadger,
        uint256 _totalSupply
    )
        private
        pure
        returns (uint256)
    {
        uint256 sqrtKPrices = _sqrt(
            _k
            .mul(_usdPerBtc).div(BASE)
            .mul(_usdPerBadger).div(BASE)
        );

        return BASE
            .mul(2)
            .mul(sqrtKPrices)
            .div(_totalSupply);
    }

    /* solium-disable whitespace */
    /**
     * @dev Calculate sqrt (x) rounding down, where x is unsigned 256-bit integer
     * number.
     *
     * From https://github.com/abdk-consulting/abdk-libraries-solidity/blob/16d7e1dd8628dfa2f88d5dadab731df7ada70bdd/ABDKMath64x64.sol#L687
     */
    function _sqrt(
        uint256 x
    )
        private
        pure
        returns (uint256)
    {
        if (x == 0) return 0;
        else {
            uint256 xx = x;
            uint256 r = 1;
            if (xx >= 0x100000000000000000000000000000000) { xx >>= 128; r <<= 64; }
            if (xx >= 0x10000000000000000) { xx >>= 64; r <<= 32; }
            if (xx >= 0x100000000) { xx >>= 32; r <<= 16; }
            if (xx >= 0x10000) { xx >>= 16; r <<= 8; }
            if (xx >= 0x100) { xx >>= 8; r <<= 4; }
            if (xx >= 0x10) { xx >>= 4; r <<= 2; }
            if (xx >= 0x8) { r <<= 1; }
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1;
            r = (r + x / r) >> 1; // Seven iterations should be enough
            uint256 r1 = x / r;
            return r < r1 ? r : r1;
        }
    }
}
