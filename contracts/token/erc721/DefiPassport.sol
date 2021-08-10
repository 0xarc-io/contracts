pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import {ERC721Full} from "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import {Counters} from "@openzeppelin/contracts/drafts/Counters.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {Adminable} from "../../lib/Adminable.sol";
import {Initializable} from "../../lib/Initializable.sol";
import {DefiPassportStorage} from "./DefiPassportStorage.sol";
import {ISapphireCreditScore} from "../../debt/sapphire/ISapphireCreditScore.sol";

contract DefiPassport is ERC721Full, Adminable, DefiPassportStorage, Initializable {

    /* ========== Libraries ========== */

    using Counters for Counters.Counter;

    /* ========== Events ========== */

    event BaseURISet(string _baseURI);

    event ApprovedSkinStatusChanged(
        address _skin,
        uint256 _skinTokenId,
        bool _status
    );

    event DefaultSkinStatusChanged(
        address _skin,
        bool _status
    );

    event DefaultActiveSkinChanged(
        address _skin
    );

    event ActiveSkinSet(
        uint256 _tokenId,
        SkinRecord _skinRecord
    );

    event SkinManagerSet(address _skinManager);

    event CreditScoreContractSet(address _creditScoreContract);

    /* ========== Constructor ========== */

    constructor()
        ERC721Full("", "")
        public
    {}

    /* ========== Modifier ========== */

    modifier onlySkinManager () {
        require(
            msg.sender == skinManager,
            "DefiPassport: caller is not skin manager"
        );
        _;
    }

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

    /**
     * @dev Sets the base URI that is appended as a prefix to the
     *      token URI.
     */
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
     * @dev Sets the address of the skin manager role
     *
     * @param _skinManager The new skin manager
     */
    function setSkinManager(
        address _skinManager
    )
        external
        onlyAdmin
    {
        require (
            _skinManager != skinManager,
            "DefiPassport: the same skin manager is already set"
        );

        skinManager = _skinManager;

        emit SkinManagerSet(skinManager);
    }

    /**
     * @notice Registers/unregisters a default skin
     *
     * @param _skin Address of the skin NFT
     * @param _status Wether or not it should be considered as a default
     *                skin or not
     */
    function setDefaultSkin(
        address _skin,
        bool _status
    )
        external
        onlySkinManager
    {
        if (!_status) {
            require(
                defaultActiveSkin != _skin,
                "Defi Passport: the skin is used as default active one"
            );
        }

        require(
            defaultSkins[_skin] != _status,
            "DefiPassport: skin already has the same status"
        );

        require(
            _skin.isContract(),
            "DefiPassport: the given skin is not a contract"
        );

        require (
            IERC721(_skin).ownerOf(1) != address(0),
            "DefiPassport: default skin must at least have tokenId eq 1"
        );

        if (defaultActiveSkin == address(0)) {
            defaultActiveSkin = _skin;
        }

        defaultSkins[_skin] = _status;

        emit DefaultSkinStatusChanged(_skin, _status);
    }

    /**
     * @dev     Set the default active skin, which will be used instead of
     *          unavailable user's active one
     * @notice Skin should be used as default one (with setDefaultSkin function)
     *
     * @param _skin Address of the skin NFT
     */
    function setDefaultActiveSkin(
        address _skin
    )
        external
        onlySkinManager
    {
        require(
            defaultSkins[_skin],
            "DefiPassport: the skin is not default one"
        );

        require(
            defaultActiveSkin != _skin,
            "DefiPassport: the skin is already set"
        );

        defaultActiveSkin = _skin;

        emit DefaultActiveSkinChanged(_skin);
    }

    /**
     * @notice Approves a passport skin.
     *         Only callable by the skin manager
     */
    function setApprovedSkin(
        address _skin,
        uint256 _skinTokenId,
        bool _status
    )
        external
        onlySkinManager
    {
        require(
            approvedSkins[_skin][_skinTokenId] != _status,
            "DefiPassport: skin already has the same status"
        );

        approvedSkins[_skin][_skinTokenId] = _status;

        emit ApprovedSkinStatusChanged(_skin, _skinTokenId, _status);
    }

    function setCreditScoreContract(
        address _creditScoreAddress
    )
        external
        onlyAdmin
    {
        require(
            address(creditScoreContract) != _creditScoreAddress,
            "DefiPassport: the same credit score address is already set"
        );

        require(
            _creditScoreAddress.isContract(),
            "DefiPassport: the given address is not a contract"
        );

        creditScoreContract = ISapphireCreditScore(_creditScoreAddress);

        emit CreditScoreContractSet(_creditScoreAddress);
    }

    /* ========== Public Functions ========== */

    /**
     * @notice Mints a DeFi passport to the address specified by `_to`. Note:
     *         - The `_passportSkin` must be an approved or default skin.
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

        require (
            isSkinAvailable(_to, _passportSkin, _skinTokenId),
            "DefiPassport: invalid skin"
        );

        // A user cannot have two passports
        require(
            balanceOf(_to) == 0,
            "DefiPassport: user already has a defi passport"
        );

        _tokenIds.increment();

        uint256 newTokenId = _tokenIds.current();
        _mint(_to, newTokenId);
        _setTokenURI(newTokenId, _toAsciiString(_to));
        _setActiveSkin(newTokenId, SkinRecord(_to, _passportSkin, _skinTokenId));

        return newTokenId;
    }

    /**
     * @notice Changes the passport skin of the caller's passport
     *
     * @param _skin The contract address to the skin NFT
     * @param _skinTokenId The ID of the kin NFT
     */
    function setActiveSkin(
        address _skin,
        uint256 _skinTokenId
    )
        external
    {
        require(
            balanceOf(msg.sender) > 0,
            "DefiPassport: caller has no passport"
        );

        require(
            isSkinAvailable(msg.sender, _skin, _skinTokenId),
            "DefiPassport: invalid skin"
        );

        uint256 tokenId = tokenOfOwnerByIndex(msg.sender, 0);

        _setActiveSkin(tokenId, SkinRecord(msg.sender, _skin, _skinTokenId));
    }

    function approve(
        address to,
        uint256 tokenId
    )
        public
    {
        revert("DefiPassport: defi passports are not transferrable");
    }

    function setApprovalForAll(
        address to,
        bool approved
    )
        public
    {
        revert("DefiPassport: defi passports are not transferrable");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
    {
        revert("DefiPassport: defi passports are not transferrable");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    )
        public
    {
        revert("DefiPassport: defi passports are not transferrable");
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
    {
        revert("DefiPassport: defi passports are not transferrable");
    }

    /* ========== Public View Functions ========== */

    /**
     * @notice Returns whether a certain skin can be applied to the specified
     *         user's passport.
     *
     * @param _user The user for whom to check
     * @param _skinContract The address of the skin NFT
     * @param _skinTokenId The NFT token ID
     */
    function isSkinAvailable(
        address _user,
        address _skinContract,
        uint256 _skinTokenId
    )
        public
        view
        returns (bool)
    {
        // Ensure the token exists
        require (
            IERC721(_skinContract).ownerOf(_skinTokenId) != address(0),
            "DefiPassport: the specified skin token id does not exist"
        );

        return defaultSkins[_skinContract] ||
            (
                approvedSkins[_skinContract][_skinTokenId] &&
                _isSkinOwner(_user, _skinContract, _skinTokenId)
            );
    }

    /**
     * @notice Passport id to its active skin NFT
     *
     * @param _tokenId Passport id
     */
    function activeSkins(
        uint256 _tokenId
    )
        public
        view
        returns (SkinRecord memory)
    {
        SkinRecord memory _activeSkin = _activeSkins[_tokenId];

        if (isSkinAvailable(_activeSkin.owner, _activeSkin.skin, _activeSkin.skinTokenId)) {
            return _activeSkin;
        } else {
            return SkinRecord(msg.sender, defaultActiveSkin, 1);
        }
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
        SkinRecord memory currentSkin = _activeSkins[_tokenId];

        require(
            currentSkin.skin != _skinRecord.skin ||
            currentSkin.skinTokenId != _skinRecord.skinTokenId,
            "DefiPassport: the same skin is already active"
        );

        _activeSkins[_tokenId] = _skinRecord;

        emit ActiveSkinSet(_tokenId, _skinRecord);
    }
}
