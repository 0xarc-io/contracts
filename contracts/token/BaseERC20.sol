pragma solidity 0.6.6;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {console} from "@nomiclabs/buidler/console.sol";


/**
 * @title ERC20 Token
 * @author ARC
 *
 * Basic ERC20 Implementation
 */
contract BaseERC20 {
    using SafeMath for uint256;

    // ============ Variables ============

    string tokenName;
    string tokenSymbol;
    uint256 tokenSupply;

    mapping(address => uint256) balances;
    mapping(address => mapping(address => uint256)) allowances;

    // ============ Events ============

    event Transfer(address token, address from, address to, uint256 value);
    event Approval(
        address token,
        address owner,
        address spender,
        uint256 value
    );

    // ============ Constructor ============

    constructor(string memory name, string memory symbol) public {
        tokenName = name;
        tokenSymbol = symbol;
    }

    // ============ Public Functions ============

    function symbol() public returns (string memory) {
        return tokenSymbol;
    }

    function name() public returns (string memory) {
        return tokenName;
    }

    function decimals() public pure returns (uint8) {
        return 18;
    }

    function totalSupply() public view returns (uint256) {
        return tokenSupply;
    }

    function balanceOf(address who) public view returns (uint256) {
        return balances[who];
    }

    function allowance(address owner, address spender)
        public
        view
        returns (uint256)
    {
        return allowances[owner][spender];
    }

    // ============ Internal Functions ============

    function _mint(address to, uint256 value) internal {
        console.log("mint(to: %s, value: %s)", to, value);

        require(to != address(0), "Cannot) mint to zero address");

        balances[to] = balances[to].add(value);
        tokenSupply = tokenSupply.add(value);

        emit Transfer(address(this), address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        console.log("burn(from: %s, value: %s)", from, value);
        require(from != address(0), "Cannot burn to zero");

        balances[from] = balances[from].sub(value);
        tokenSupply = tokenSupply.sub(value);

        emit Transfer(address(this), from, address(0), value);
    }

    // ============ Token Functions ============

    function transfer(address to, uint256 value) public returns (bool) {
        console.log("mint(to: %s, value: %s)", to, value);

        if (balances[msg.sender] >= value) {
            balances[msg.sender] = balances[msg.sender].sub(value);
            balances[to] = balances[to].add(value);
            emit Transfer(address(this), msg.sender, to, value);
            return true;
        } else {
            return false;
        }
    }

    function transferFrom(address from, address to, uint256 value)
        public
        returns (bool)
    {
        console.log(
            "transferFrom(from: %s, to: %s, value: %s",
            from,
            to,
            value
        );

        if (balances[from] >= value && allowances[from][msg.sender] >= value) {
            balances[to] = balances[to].add(value);
            balances[from] = balances[from].sub(value);
            allowances[from][msg.sender] = allowances[from][msg.sender].sub(
                value
            );
            emit Transfer(address(this), from, to, value);
            return true;
        } else {
            return false;
        }
    }

    function approve(address spender, uint256 value) public returns (bool) {
        console.log("approve(spender: %s, value: %s", spender, value);

        allowances[msg.sender][spender] = value;
        emit Approval(address(this), msg.sender, spender, value);
        return true;
    }
}
