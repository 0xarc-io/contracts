import {Address} from "../lib/Address.sol";
import {Adminable} from "../lib/Adminable.sol";
import {Initializable} from "../lib/Initializable.sol";
import {IPermittableERC20} from "../token/IPermittableERC20.sol";
import {ISablier} from "../global/ISablier.sol";

contract KermanRewards is Adminable, Initializable {
    /* ========== Libraries ========== */

    using Address for address;

    /* ========== Variables ========== */

    IPermittableERC20 public stakingToken;

    ISablier public sablierContract;
    uint256 public sablierStreamId;

    /* ========== Restricted Functions ========== */

    function init(
        address _sablierContract, 
        address _stakingToken
    )
        external
        onlyAdmin
        initializer 
    {
        require (
            _stakingToken.isContract(),
            "KermanRewards: staking token is not a contract"
        );

        require (
            _sablierContract.isContract(),
            "KermanRewards: the sablier contract is invalid"
        );
        stakingToken = IPermittableERC20(_stakingToken);
        sablierContract = ISablier(_sablierContract);
    }
}
