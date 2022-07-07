// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8.7;

error Anonim__NeedMoreThanZero(uint256 amount);
error Anonim__NotSupplied();
error Anonim__CannotWithdrawMoreThanSupplied(uint256 amount);
error Anonim__CouldNotBorrowMoreThan80PercentOfCollateral();
error Anonim__ThisTokenIsNotAvailable(address tokenAddress);
error Anonim__NotAllowedBeforeRepayingExistingLoan(uint256 amount);
error Anonim__TransactionFailed();
error Anonim__SorryWeCurrentlyDoNotHaveThisToken(address tokenAddress);
error Anonim__UpKeepNotNeeded();

contract Anonim is ReentrancyGuard, KeeperCompatibleInterface, Ownable {
    address[] private s_allowedTokens;
    address[] private s_suppliers;
    address[] private s_borrowers;
    uint256 private immutable i_interval;
    uint256 private s_lastTimeStamp;

    //////////////////
    //// Events /////
    ////////////////

    event TokenSupplied(
        address indexed tokenAddress,
        address indexed userAddress,
        uint256 indexed amount
    );
    event TokenWithdrawn(
        address indexed tokenAddress,
        address indexed userAddress,
        uint256 indexed amount
    );
    event TokenBorrowed(
        address indexed tokenAddress,
        address indexed userAddress,
        uint256 indexed amount
    );
    event TokenRepaid(
        address indexed tokenAddress,
        address indexed userAddress,
        uint256 indexed amount
    );

    //////////////////////
    /////  mappings  /////
    /////////////////////

    // token address -> total supply of that token
    mapping(address => uint256) private s_totalSupply;

    // tokenAddress & user address -> their supplied balances
    mapping(address => mapping(address => uint256)) private s_supplyBalances;

    // tokenAddress & user adddress -> their borrowed balance
    mapping(address => mapping(address => uint256)) private s_borrowedBalances;

    // token address -> price feeds
    mapping(address => AggregatorV3Interface) private s_priceFeeds;

    // userAddress -> all of his unique supplied tokens
    mapping(address => address[]) private s_supplierUniqueTokens;

    // userAddress -> all of his unique borrowed tokens
    mapping(address => address[]) private s_borrowerUniqueTokens;

    /////////////////////
    ///   Modifiers   ///
    /////////////////////

    modifier hasSupplied() {
        bool success;
        for (uint256 i = 0; i < s_allowedTokens.length; i++) {
            if (s_supplyBalances[s_allowedTokens[i]][msg.sender] > 0) {
                success = true;
            }
        }

        if (!success) {
            revert Anonim__NotSupplied();
        }
        _;
    }

    modifier notZero(uint256 amount) {
        if (amount <= 0) {
            revert Anonim__NeedMoreThanZero(amount);
        }
        _;
    }

    modifier isTokenAllowed(address tokenAddress) {
        bool execute;
        for (uint256 i = 0; i < s_allowedTokens.length; i++) {
            if (s_allowedTokens[i] == tokenAddress) {
                execute = true;
            }
        }

        if (!execute) {
            revert Anonim__ThisTokenIsNotAvailable(tokenAddress);
        }
        _;
    }

    //////////////////////////
    ///  Main  Functions   ///
    /////////////////////////

    constructor(
        address[] memory allowedTokens,
        address[] memory priceFeeds,
        uint256 updateInterval
    ) {
        s_allowedTokens = allowedTokens;
        for (uint256 i = 0; i < allowedTokens.length; i++) {
            s_priceFeeds[allowedTokens[i]] = AggregatorV3Interface(priceFeeds[i]);
        }
        i_interval = updateInterval;
        s_lastTimeStamp = block.timestamp;
    }

    function supply(address tokenAddress, uint256 amount)
        external
        payable
        isTokenAllowed(tokenAddress)
        notZero(amount)
        nonReentrant
    {
        bool success = IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert Anonim__TransactionFailed();
        }
        s_totalSupply[tokenAddress] += amount;
        s_supplyBalances[tokenAddress][msg.sender] += amount;
        addSupplier(msg.sender);
        addUniqueToken(s_supplierUniqueTokens[msg.sender], tokenAddress);
        emit TokenSupplied(tokenAddress, msg.sender, amount);
    }

    function withdraw(address tokenAddress, uint256 amount)
        external
        payable
        hasSupplied
        notZero(amount)
        nonReentrant
    {
        if (amount > s_supplyBalances[tokenAddress][msg.sender]) {
            revert Anonim__CannotWithdrawMoreThanSupplied(amount);
        }

        revertIfHighBorrowing(tokenAddress, msg.sender, amount);
        s_supplyBalances[tokenAddress][msg.sender] -= amount;
        s_totalSupply[tokenAddress] -= amount;
        removeSupplierAndUniqueToken(tokenAddress, msg.sender);
        IERC20(tokenAddress).transfer(msg.sender, amount);
        emit TokenWithdrawn(tokenAddress, msg.sender, amount);
    }

    function borrow(address tokenAddress, uint256 amount)
        external
        payable
        isTokenAllowed(tokenAddress)
        hasSupplied
        notZero(amount)
        nonReentrant
    {
        if (s_totalSupply[tokenAddress] <= 0) {
            revert Anonim__SorryWeCurrentlyDoNotHaveThisToken(tokenAddress);
        }

        notMoreThanMaxBorrow(tokenAddress, msg.sender, amount);
        addBorrower(msg.sender);
        addUniqueToken(s_borrowerUniqueTokens[msg.sender], tokenAddress);
        s_borrowedBalances[tokenAddress][msg.sender] += amount;
        s_totalSupply[tokenAddress] -= amount;
        IERC20(tokenAddress).transfer(msg.sender, amount);
        emit TokenBorrowed(tokenAddress, msg.sender, amount);
    }

    function repay(address tokenAddress, uint256 amount)
        external
        payable
        notZero(amount)
        nonReentrant
    {
        bool success = IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert Anonim__TransactionFailed();
        }

        s_borrowedBalances[tokenAddress][msg.sender] -= amount;
        s_totalSupply[tokenAddress] += amount;
        removeBorrowerAndUniqueToken(tokenAddress, msg.sender);
        emit TokenRepaid(tokenAddress, msg.sender, amount);
    }

    function liquidation() external onlyOwner {
        for (uint256 i = 0; i < s_borrowers.length; i++) {
            if (getTotalBorrowValue(s_borrowers[i]) >= getTotalSupplyValue(s_borrowers[i])) {
                for (uint256 index = 0; index < s_allowedTokens.length; index++) {
                    s_supplyBalances[s_allowedTokens[index]][s_borrowers[i]] = 0;
                    s_borrowedBalances[s_allowedTokens[index]][s_borrowers[i]] = 0;
                }
            }
        }
    }

    function chargeAPY() private {
        for (uint256 i = 0; i < s_borrowers.length; i++) {
            for (
                uint256 index = 0;
                index < s_borrowerUniqueTokens[s_borrowers[i]].length;
                index++
            ) {
                s_borrowedBalances[s_borrowerUniqueTokens[s_borrowers[i]][index]][
                    s_borrowers[i]
                ] += (
                    (s_borrowedBalances[s_borrowerUniqueTokens[s_borrowers[i]][index]][
                        s_borrowers[i]
                    ] / uint256(50)) // chargind 2 % APY per 30 sec
                );
            }
        }
    }

    function rewardAPY() private {
        for (uint256 i = 0; i < s_suppliers.length; i++) {
            for (
                uint256 index = 0;
                index < s_supplierUniqueTokens[s_suppliers[i]].length;
                index++
            ) {
                s_supplyBalances[s_supplierUniqueTokens[s_suppliers[i]][index]][
                    s_suppliers[i]
                ] += (s_supplyBalances[s_supplierUniqueTokens[s_suppliers[i]][index]][
                    s_suppliers[i]
                ] / uint256(100)); // rewarding 1 % APY per 30 sec
            }
        }
    }

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        )
    {
        bool hasUsers = (s_borrowers.length > 0) || (s_suppliers.length > 0);
        bool isTimePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        upkeepNeeded = (hasUsers && isTimePassed);
        return (upkeepNeeded, "0x0");
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");

        if (!upkeepNeeded) {
            revert Anonim__UpKeepNotNeeded();
        }

        if (s_borrowers.length > 0) {
            chargeAPY();
        }

        if (s_suppliers.length > 0) {
            rewardAPY();
        }

        s_lastTimeStamp = block.timestamp;
    }

    function faucet(address tokenAddress) external {
        IERC20(tokenAddress).transfer(msg.sender, 10000 * 10**18);
    }

    ////////////////////////
    // Helper functions ////
    ///////////////////////

    function revertIfHighBorrowing(
        address tokenAddress,
        address userAddress,
        uint256 amount
    ) private view {
        uint256 availableAmountValue = getTotalSupplyValue(userAddress) -
            ((uint256(100) * getTotalBorrowValue(userAddress)) / uint256(80));

        (uint256 price, uint256 decimals) = getLatestPrice(tokenAddress);
        uint256 askedAmountValue = amount * (price / 10**decimals);

        if (askedAmountValue > availableAmountValue) {
            revert Anonim__NotAllowedBeforeRepayingExistingLoan(amount);
        }
    }

    function notMoreThanMaxBorrow(
        address tokenAddress,
        address userAddress,
        uint256 amount
    ) private view {
        uint256 maxBorrow = getMaxBorrow(userAddress);
        (uint256 price, uint256 decimals) = getLatestPrice(tokenAddress);
        uint256 askedAmountValue = amount * (price / 10**decimals);

        if (askedAmountValue > maxBorrow) {
            revert Anonim__CouldNotBorrowMoreThan80PercentOfCollateral();
        }
    }

    function addUniqueToken(address[] storage uniqueTokenArray, address tokenAddress) private {
        if (uniqueTokenArray.length == 0) {
            uniqueTokenArray.push(tokenAddress);
        } else {
            bool add = true;
            for (uint256 i = 0; i < uniqueTokenArray.length; i++) {
                if (uniqueTokenArray[i] == tokenAddress) {
                    add = false;
                }
            }
            if (add) {
                uniqueTokenArray.push(tokenAddress);
            }
        }
    }

    function addSupplier(address userAddress) private {
        if (s_suppliers.length == 0) {
            s_suppliers.push(userAddress);
        } else {
            bool add = true;
            for (uint256 i = 0; i < s_suppliers.length; i++) {
                if (s_suppliers[i] == userAddress) {
                    add = false;
                }
            }
            if (add) {
                s_suppliers.push(userAddress);
            }
        }
    }

    function addBorrower(address userAddress) private {
        if (s_borrowers.length == 0) {
            s_borrowers.push(userAddress);
        } else {
            bool add = true;
            for (uint256 i = 0; i < s_borrowers.length; i++) {
                if (s_borrowers[i] == userAddress) {
                    add = false;
                }
            }
            if (add) {
                s_borrowers.push(userAddress);
            }
        }
    }

    function removeSupplierAndUniqueToken(address tokenAddress, address userAddress) private {
        if (s_supplyBalances[tokenAddress][userAddress] <= 0) {
            remove(s_supplierUniqueTokens[userAddress], tokenAddress);
        }

        if (s_supplierUniqueTokens[userAddress].length == 0) {
            remove(s_suppliers, userAddress);
        }
    }

    function removeBorrowerAndUniqueToken(address tokenAddress, address userAddress) private {
        if (s_borrowedBalances[tokenAddress][userAddress] <= 0) {
            remove(s_borrowerUniqueTokens[userAddress], tokenAddress);
        }
        if (s_borrowerUniqueTokens[userAddress].length == 0) {
            remove(s_borrowers, userAddress);
        }
    }

    function remove(address[] storage array, address removingAddress) private {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == removingAddress) {
                array[i] = array[array.length - 1];
                array.pop();
            }
        }
    }

    ////////////////////////////
    ///   getter functions   ///
    ////////////////////////////

    function getTokenTotalSupply(address tokenAddress) external view returns (uint256) {
        return s_totalSupply[tokenAddress];
    }

    function getAllTokenSupplyInUsd() external view returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i = 0; i < s_allowedTokens.length; i++) {
            (uint256 price, uint256 decimals) = getLatestPrice(s_allowedTokens[i]);

            totalValue += ((price / 10**decimals) * s_totalSupply[s_allowedTokens[i]]);
        }
        return totalValue;
    }

    function getSupplyBalance(address tokenAddress, address userAddress)
        external
        view
        returns (uint256)
    {
        return s_supplyBalances[tokenAddress][userAddress];
    }

    function getBorrowedBalance(address tokenAddress, address userAddress)
        external
        view
        returns (uint256)
    {
        return s_borrowedBalances[tokenAddress][userAddress];
    }

    function getLatestPrice(address tokenAddress) public view returns (uint256, uint256) {
        (, int256 price, , , ) = s_priceFeeds[tokenAddress].latestRoundData();
        uint256 decimals = uint256(s_priceFeeds[tokenAddress].decimals());
        return (uint256(price), decimals);
    }

    function getMaxBorrow(address userAddress) public view returns (uint256) {
        uint256 availableAmountValue = getTotalSupplyValue(userAddress) -
            ((uint256(100) * getTotalBorrowValue(userAddress)) / uint256(80));

        return (availableAmountValue * uint256(80)) / uint256(100);
    }

    function getMaxWithdraw(address tokenAddress, address userAddress)
        external
        view
        returns (uint256)
    {
        uint256 availableAmount = s_supplyBalances[tokenAddress][userAddress] -
            ((uint256(100) * s_borrowedBalances[tokenAddress][userAddress]) / uint256(80));

        return availableAmount;
    }

    function getMaxTokenBorrow(address tokenAddress, address userAddress)
        external
        view
        returns (uint256)
    {
        uint256 availableAmountValue = getTotalSupplyValue(userAddress) -
            ((uint256(100) * getTotalBorrowValue(userAddress)) / uint256(80));

        (uint256 price, uint256 decimals) = getLatestPrice(tokenAddress);
        return ((availableAmountValue / (price / 10**decimals)) * uint256(80)) / uint256(100);
    }

    function getTotalSupplyValue(address userAddress) public view returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i = 0; i < s_allowedTokens.length; i++) {
            (uint256 price, uint256 decimals) = getLatestPrice(s_allowedTokens[i]);

            totalValue += ((price / 10**decimals) *
                s_supplyBalances[s_allowedTokens[i]][userAddress]);
        }
        return totalValue;
    }

    function getTotalBorrowValue(address userAddress) public view returns (uint256) {
        uint256 totalValue = 0;
        for (uint256 i = 0; i < s_allowedTokens.length; i++) {
            (uint256 price, uint256 decimals) = getLatestPrice(s_allowedTokens[i]);
            totalValue += ((price / 10**decimals) *
                s_borrowedBalances[s_allowedTokens[i]][userAddress]);
        }
        return totalValue;
    }

    function getAllowedTokens() external view returns (address[] memory) {
        return s_allowedTokens;
    }

    function getSuppliers() external view returns (address[] memory) {
        return s_suppliers;
    }

    function getBorrowers() external view returns (address[] memory) {
        return s_borrowers;
    }

    function getUniqueSupplierTokens(address userAddress)
        external
        view
        returns (address[] memory)
    {
        return s_supplierUniqueTokens[userAddress];
    }

    function getUniqueBorrowerTokens(address userAddress)
        external
        view
        returns (address[] memory)
    {
        return s_borrowerUniqueTokens[userAddress];
    }

    function getInterval() external view returns (uint256) {
        return i_interval;
    }
}
