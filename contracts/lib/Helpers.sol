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

    function supplyCompounded()
        public
        view
        returns (Decimal.D256 memory)
    {

    }

    function borrowsCompounded()
        public
        view
        returns (Decimal.D256 memory)
    {

    }

    function supplierCompoundedBalance(
        address supplier
    )
        public
        view
        returns (Decimal.D256 memory compoundedBalance)
    {

    }

    function borrowerCompoundedBalance(
        address borrower
    )
        public
        view
        returns (Decimal.D256 memory compoundedBalance)
    {

    }
}