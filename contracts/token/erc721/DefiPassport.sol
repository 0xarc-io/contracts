pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {ERC721Full} from "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import {Counters} from "@openzeppelin/contracts/drafts/Counters.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {Adminable} from "../../lib/Adminable.sol";
import {Initializable} from "../../Initializable.sol";
import {DefiPassportStorage} from "./DefiPassportStorage.sol";
import {ISapphireCreditScore} from "../../debt/sapphire/ISapphireCreditScore.sol";

contract DefiPassport is ERC721Full, Adminable, DefiPassportStorage, Initializable {

    /* ========== Libraries ========== */

    using Counters for Counters.Counter;

    /* ========== Events ========== */

    event BaseURISet(string _baseURI);

    event ApprovedSkin(address _skin);

    event ActiveSkinSet(
        uint256 _tokenId,
        SkinRecord _skinRecord
    );

    /* ========== Modifiers ========== */

    modifier onlySkinManager() {
        require(
            msg.sender == skinManager,
            "DefiPassport: caller is not skin manager"
        );
        _;
    }

    /* ========== Constructor ========== */

    constructor()
        ERC721Full("", "")
        public
    {}

    /* ========== Restricted Functions ========== */

    function init(
        string calldata _name,
        string calldata _symbol,
        address _creditScoreAddress,
        address _skinManager
    )
        external
        onlyAdmin
        initializer
    {
        name = _name;
        symbol = _symbol;
        skinManager = _skinManager;

        require(
            _creditScoreAddress.isContract(),
            "DefiPassport: credit score address is not a contract"
        );

        creditScoreContract = ISapphireCreditScore(_creditScoreAddress);

        /*
        *   register the supported interfaces to conform to ERC721 via ERC165
        *   bytes4(keccak256('name()')) == 0x06fdde03
        *   bytes4(keccak256('symbol()')) == 0x95d89b41
        *   bytes4(keccak256('tokenURI(uint256)')) == 0xc87b56dd
        *
        *   => 0x06fdde03 ^ 0x95d89b41 ^ 0xc87b56dd == 0x5b5e139f
        */
        _registerInterface(0x5b5e139f);
    }

    function setBaseURI(
        string calldata _baseURI
    )
        external
        onlyAdmin
    {
        _setBaseURI(_baseURI);
        emit BaseURISet(_baseURI);
    }

    /**
     * @notice Approves a passport skin.
     *         Only callable by the skin manager
     */
    function approveSkin(
        address _skin
    )
        external
        onlySkinManager
    {
        require(
            !approvedSkins[_skin],
            "DefiPassport: skin is already approved"
        );

        approvedSkins[_skin] = true;

        emit ApprovedSkin(_skin);
    }

    /* ========== Public Functions ========== */

    /**
     * @notice Mints a DeFi passport to the address specified by `_to`. Note:
     *         - The `_passportSkin` must be an approved skin.
     *         - The token URI will be composed by <baseURI> + `_to`,
     *           without the "0x" in front
     *
     * @param _to The receiver of the defi passport
     * @param _passportSkin The address of the skin NFT to be applied to the passport
     * @param _skinTokenId The ID of the passport skin NFT, owned by the receiver
     */
    function mint(
        address _to,
        address _passportSkin,
        uint256 _skinTokenId
    )
        external
        returns (uint256)
    {
        (uint256 userCreditScore,,) = creditScoreContract.getLastScore(_to);

        require(
            userCreditScore > 0,
            "DefiPassport: the user has no credit score"
        );

        require(
            approvedSkins[_passportSkin],
            "DefiPassport: the skin is not approved"
        );

        // A user cannot have two passports
        require(
            balanceOf(_to) == 0,
            "DefiPassport: user already has a defi passport"
        );

        require(
            _isSkinOwner(_to, _passportSkin, _skinTokenId),
            "DefiPassport: the receiver does not own the skin"
        );

        _tokenIds.increment();

        uint256 newTokenId = _tokenIds.current();
        _mint(_to, newTokenId);
        _setTokenURI(newTokenId, _toAsciiString(_to));
        _setActiveSkin(newTokenId, SkinRecord(_passportSkin, _skinTokenId));

        return newTokenId;
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

    /**
     * @dev Ensures that the user is the owner of the skin NFT
     */
    function _isSkinOwner(
        address _user,
        address _skin,
        uint256 _tokenId
    )
        internal
        view
        returns (bool)
    {
        return IERC721(_skin).ownerOf(_tokenId) == _user;
    }

    function _setActiveSkin(
        uint256 _tokenId,
        SkinRecord memory _skinRecord
    )
        private
    {
        SkinRecord memory currentSkin = activeSkins[_tokenId];

        require(
            currentSkin.skin != _skinRecord.skin &&
            currentSkin.skinTokenId != _skinRecord.skinTokenId,
            "DefiPassport: the same skin is already active"
        );

        activeSkins[_tokenId] = _skinRecord;

        emit ActiveSkinSet(_tokenId, _skinRecord);
    }
}
