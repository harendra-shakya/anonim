// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ANT is ERC20 {
    constructor() ERC20("Anonim Token", "ANT") {
        _mint(msg.sender, 10000000000000000000000000000000);
    }
}
