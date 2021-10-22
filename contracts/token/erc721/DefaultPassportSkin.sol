// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";

import {Ownable} from "../../lib/Ownable.sol";

contract DefaultPassportSkin is Ownable, ERC721URIStorage, ERC721Enumerable {

    /* ========== Libraries ========== */

    using Counters for Counters.Counter;

    /* ========== Public variables ========== */

    string public baseURI;

    /* ========== Private variables ========== */

    Counters.Counter internal _tokenIds;

    /* ========== Events ========== */

    event BaseURISet(string _baseURI);

    /* ========== Constructor ========== */

    constructor(
        string memory _name,
        string memory _symbol
    )
        ERC721(_name, _symbol)
    {} // solhint-disable-line

    /* ========== Restricted Functions ========== */

    /**
     * @dev Mints a new default skin with an optional _tokenURI
     *
     * @param _to The receiver of the skin
     */
    function mint(
        address _to,
        string calldata _tokenURI
    )
        external
        onlyOwner
        returns (uint256)
    {
        _tokenIds.increment();

        uint256 newTokenId = _tokenIds.current();
        _mint(_to, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);

        return newTokenId;
    }

    /**
     * @dev Sets the base URI that is appended as a prefix to the
     *      token URI.
     */
    function setBaseURI(
        string calldata baseURI_
    )
        external
        onlyOwner
    {
        baseURI = baseURI_;
        emit BaseURISet(baseURI_);
    }

    /* ========== Internal Functions ========== */

    function _baseURI()
        internal
        view
        override
        returns (string memory)
    {
        return baseURI;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    )
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, ERC721Enumerable)
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage)
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }
}
