pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Decimal} from "./Decimal.sol";

library Helpers {

    using SafeMath for uint256;

    function utilisationRatio(
        uint256 borrowTotal,
        uint256 supplyTotal
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        if (borrowTotal == 0) {
            return Decimal.D256({ value: 0 });
        }

        uint256 invertedResult = supplyTotal.div(borrowTotal);
        uint256 result = Decimal.BASE.div(invertedResult);

        return Decimal.D256({ value: result });
    }

    function supplyCompounded(
        uint256 supplyTotal,
        Decimal.D256 memory currentIndex
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        uint256 result = Decimal.mul(
            supplyTotal,
            currentIndex
        );

        return Decimal.D256({ value: result });
    }

    function borrowsCompounded(
        uint256 borrowTotal,
        Decimal.D256 memory currentIndex
    )
        public
        view
        returns (Decimal.D256 memory)
    {
        uint256 result = Decimal.mul(
            borrowTotal,
            currentIndex
        );

        return Decimal.D256({ value: result });
    }

    function supplierBalanceCompounded(
        uint256 balance,
        uint256 totalSupply,
        uint256 totalBorrow,
        Decimal.D256 memory currentIndex,
        Decimal.D256 memory lastIndex
    )
        public
        view
        returns (Decimal.D256 memory compoundedBalance)
    {

        uint256 portion = totalSupply.div(balance);
        portion = Decimal.BASE.div(portion);

        uint256 result = Decimal.mul(
            portion.mul(totalBorrow),
            Decimal.D256({ value: currentIndex.value.sub(Decimal.one().value) })
        );

        return Decimal.D256({ value: result.add(balance) });
    }

    function borrowBalanceCompounded(
        uint256 balance,
        uint256 totalBorrow,
        Decimal.D256 memory currentIndex,
        Decimal.D256 memory lastIndex
    )
        public
        view
        returns (Decimal.D256 memory compoundedBalance)
    {

        uint256 portion = totalBorrow.div(balance);
        portion = Decimal.BASE.div(portion);

        uint256 result = Decimal.mul(
            portion.mul(totalBorrow),
            Decimal.D256({ value: currentIndex.value.sub(Decimal.one().value) })
        );

        return Decimal.D256({ value: result.add(balance) });

    }
}