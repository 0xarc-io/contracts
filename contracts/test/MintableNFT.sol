// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MintableNFT is ERC721 {

    constructor (
        string memory _name,
        string memory _symbol
    )
        ERC721(_name, _symbol)
    {} // solhint-disable-line

    function mint(
        address _to,
        uint256 _tokenId
    )
        external
    {
        _safeMint(_to, _tokenId);
    }
}
