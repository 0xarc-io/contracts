pragma solidity 0.5.16;

import {ERC721Full} from "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import {Counters} from "@openzeppelin/contracts/drafts/Counters.sol";

import {Ownable} from "../../lib/Ownable.sol";

contract DefaultPassportSkin is ERC721Full, Ownable {
    
    /* ========== Libraries ========== */

    using Counters for Counters.Counter;

    /* ========== Private variables ========== */

    Counters.Counter internal _tokenIds;

    /* ========== Events ========== */

    event BaseURISet(string _baseURI);

    /* ========== Constructor ========== */

    constructor()
        ERC721Full("Default Defi Passport Skin", "DefaultPassportSkin")
        public
    {}
    
    /* ========== Restricted Functions ========== */

    /**
     * @dev Mints a new default skin with an optional _tokenURI
     *
     * @param _to The receiver of the skin
     */
    function mint(
        address _to
    )
        external
        onlyOwner
        returns (uint256)
    {
        _tokenIds.increment();

        uint256 newTokenId = _tokenIds.current();
        _mint(_to, newTokenId);
        _setTokenURI(newTokenId, _toAsciiString(_to));

        return newTokenId;
    }

    /**
     * @dev Sets the base URI that is appended as a prefix to the
     *      token URI.
     */
    function setBaseURI(
        string calldata _baseURI
    )
        external
        onlyOwner
    {
        _setBaseURI(_baseURI);
        emit BaseURISet(_baseURI);
    }

    /* ========== Private Functions ========== */

    /**
     * @dev Converts the given address to string. Used when minting new
     *      passports.
     */
    function _toAsciiString(
        address _address
    )
        private
        pure
        returns (string memory)
    {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(_address)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i] = _char(hi);
            s[2*i+1] = _char(lo);
        }
        return string(s);
    }

    function _char(
        bytes1 b
    )
        private
        pure
        returns (bytes1 c)
    {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}
