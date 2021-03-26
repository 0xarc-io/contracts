// SPDX-License-Identifier: MIT

pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {SafeMath} from "../../lib/SafeMath.sol";
import {Decimal} from "../../lib/Decimal.sol";
import {BaseERC20} from "../../token/BaseERC20.sol";

import {IOracle} from "../IOracle.sol";
import {IChainLinkAggregator} from "../IChainLinkAggregator.sol";

import {ISett} from "./ISett.sol";

/* solium-disable-next-line */
contract bBadgerOracle is IOracle {

    using SafeMath for uint256;

    ISett public bBadger = ISett(
        0x19D97D8fA813EE2f51aD4B4e04EA08bAf4DFfC28
    );

    BaseERC20 public badger = BaseERC20(
        0x3472A5A71965499acd81997a54BBA8D852C6E53d
    );

    IChainLinkAggregator public badgerEthChainlinkOracle = IChainLinkAggregator(
        0x58921Ac140522867bf50b9E009599Da0CA4A2379
    );

    IChainLinkAggregator public chainLinkEthAggregator = IChainLinkAggregator(
        0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
    );

    uint256 badgerEthChainlinkScalar;
    uint256 chainlinkEthScalar;
    uint256 badgerScalar;

    constructor() public {
        badgerEthChainlinkScalar = uint256(18 - badgerEthChainlinkOracle.decimals());
        chainlinkEthScalar = uint256(18 - chainLinkEthAggregator.decimals());

        badgerScalar = uint256(18 - badger.decimals());
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        uint256 badgerPerbBadger = bBadger.getPricePerFullShare().mul(10 ** badgerScalar);

        uint256 ethPerBadger = uint256(
            badgerEthChainlinkOracle.latestAnswer()
        ).mul(10 ** badgerEthChainlinkScalar);

        uint256 usdPerEth = uint256(
            chainLinkEthAggregator.latestAnswer()
        ).mul(10 ** chainlinkEthScalar);

        uint256 ethPerbBadger = ethPerBadger.mul(badgerPerbBadger).div(10 ** 18);

        uint256 usdPerbBadger = ethPerbBadger.mul(usdPerEth).div(10 ** 18);

        require (
            usdPerbBadger > 0,
            "bBadgerOracle: cannot reoprt a price of 0"
        );

        return Decimal.D256({
            value: usdPerbBadger
        });
    }
}
