pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

interface ISyntheticToken {

    function mint(
        address to,
        uint256 value
    )
        external;

    function burn(
        address to,
        uint256 value
    )
        external;

    function transferCollateral(
        address token,
        address to,
        uint256 value
    )
        external;

}