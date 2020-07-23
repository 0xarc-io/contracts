pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import {Decimal} from "../lib/Decimal.sol";
import {IOracle} from "../interfaces/IOracle.sol";
import {IOracle} from "../interfaces/IChainLinkAggregator.sol";

contract MockOracle is IOracle {

    IChainLinkAggregator public chainLinkAggregator;

    uint256 constant public CHAIN_LINK_DECIMALS = 10**8;

    constructor(address _chainLinkAggregator) {
        chainLinkAggregator = IChainLinkAggregator(_chainLinkAggregator);
    }

    function fetchCurrentPrice()
        external
        view
        returns (Decimal.D256 memory)
    {
        return Decimal.D256({
            value: chainLinkAggregator.latestAnswer().mul(uint256(10**10))
        });
    }

}