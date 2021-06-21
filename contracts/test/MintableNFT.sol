pragma solidity 0.5.16;

import {ERC721Full} from "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import {ERC721Mintable} from "@openzeppelin/contracts/token/ERC721/ERC721Mintable.sol";

contract MintableNFT is ERC721Full, ERC721Mintable {

    constructor (
        string memory _name,
        string memory _symbol
    )
        public
        ERC721Full(_name, _symbol)
    {}
}
