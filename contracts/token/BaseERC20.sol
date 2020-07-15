pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {console} from "@nomiclabs/buidler/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ERC20 Token
 *
 * Basic ERC20 Implementation
 */
contract BaseERC20 is IERC20 {
    using SafeMath for uint256;

    // ============ Variables ============

    string private _name;
    string private _symbol;
    uint256 private _supply;
    uint8 private _decimals;

    mapping (address => uint256) private  _balances;
    mapping (address => mapping(address => uint256)) private _allowances;

    // ============ Events ============

    event Transfer(
        address token,
        address from,
        address to,
        uint256 value
    );

    event Approval(
        address token,
        address owner,
        address spender,
        uint256 value
    );

    // ============ Constructor ============

    constructor(
        string memory name,
        string memory symbol
    )
        public
    {
        _name = name;
        _symbol = symbol;
        _decimals = 18;
    }

    // ============ Public Functions ============

    function symbol()
        public
        view
        returns (string memory)
    {
        return _symbol;
    }

    function name()
        public
        view
        returns (string memory)
    {
        return _name;
    }

    function decimals()
        public
        virtual
        view
        returns (uint8)
    {
        return _decimals;
    }

    function totalSupply()
        public
        override
        view
        returns (uint256)
    {
        return _supply;
    }

    function balanceOf(
        address who
    )
        public
        override
        view returns (uint256)
    {
        return _balances[who];
    }

    function allowance(
        address owner,
        address spender
    )
        public
        override
        view
        returns (uint256)
    {
        return _allowances[owner][spender];
    }

    // ============ Internal Functions ============

    function _mint(address to, uint256 value) internal {
        console.log("mint(to: %s, value: %s)", to, value);

        require(to != address(0), "Cannot mint to zero address");

        _balances[to] = _balances[to].add(value);
        _supply = _supply.add(value);

        emit Transfer(address(this), address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        console.log("burn(from: %s, value: %s)", from, value);
        require(from != address(0), "Cannot burn to zero");

        _balances[from] = _balances[from].sub(value);
        _supply = _supply.sub(value);

        emit Transfer(address(this), from, address(0), value);
    }

    // ============ Token Functions ============

    function transfer(
        address to,
        uint256 value
    )
        public
        override
        virtual
        returns (bool)
    {
        console.log("transfer(to: %s, value: %s)", to, value);

        if (_balances[msg.sender] >= value) {
            _balances[msg.sender] = _balances[msg.sender].sub(value);
            _balances[to] = _balances[to].add(value);
            emit Transfer(address(this), msg.sender, to, value);
            console.log("transfer succeeded");
            return true;
        } else {
            console.log("transfer failed");
            return false;
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    )
        public
        override
        virtual
        returns (bool)
    {
        console.log(
            "transferFrom(from: %s, to: %s, value: %s",
            from,
            to,
            value
        );

        if (
            _balances[from] >= value &&
            _allowances[from][msg.sender] >= value
        ) {
            _balances[to] = _balances[to].add(value);
            _balances[from] = _balances[from].sub(value);
            _allowances[from][msg.sender] = _allowances[from][msg.sender].sub(
                value
            );
            emit Transfer(address(this), from, to, value);
            return true;
        } else {
            return false;
        }
    }

    function approve(
        address spender,
        uint256 value
    )
        public
        override
        returns (bool)
    {
        return _approve(msg.sender, spender, value);
    }

    function _approve(
        address owner,
        address spender,
        uint256 value
    )
        internal
        returns (bool)
    {
        console.log("approve(spender: %s, value: %s, sender: %s", spender, value, owner);

        _allowances[owner][spender] = value;

        emit Approval(
            address(this),
            owner,
            spender,
            value
        );

        return true;
    }
}
