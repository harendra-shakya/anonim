const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Anonim unit tests", function () {
          const amount = ethers.utils.parseEther("0.5");
          let anonim, wethToken, user, wethTokenAddress, daiTokenAddress, daiToken, user2;
          beforeEach(async function () {
              const accounts = await ethers.getSigners(2);
              user = accounts[0];
              user2 = accounts[1];
              const chainId = network.config.chainId;
              const wethTokenContract = await ethers.getContractFactory("WETH");
              wethToken = await wethTokenContract.deploy();
              // prettier-ignore
              await wethToken.deployed({ "from": user });
              wethTokenAddress = wethToken.address;
              const daiTokenContract = await ethers.getContractFactory("DAI");
              daiToken = await daiTokenContract.deploy();
              // prettier-ignore
              await daiToken.deployed({ "from": user });
              daiTokenAddress = daiToken.address;
              const contract = await ethers.getContractFactory("Anonim");
              anonim = await contract.deploy(
                  [wethTokenAddress, daiTokenAddress],
                  [
                      networkConfig[chainId]["ethUsdPriceFeed"],
                      networkConfig[chainId]["daiUsdPriceFeed"],
                  ],
                  networkConfig[chainId]["keepersUpdateInterval"]
              );
              // prettier-ignore
              await anonim.deployed({ "from": user });
          });
          describe("constructor", function () {
              it("intializes correctly", async function () {
                  assert((await anonim.getAllowedTokens()).length > 0);
              });
          });
          describe("supply", async function () {
              it("reverts if amount is zero", async function () {
                  // prettier-ignore
                  await wethToken.approve(anonim.address, amount, {"from": user.address});
                  await expect(anonim.supply(wethTokenAddress, 0)).to.be.revertedWith(
                      "Anonim__NeedMoreThanZero"
                  );
              });
              it("reverts if not approved", async function () {
                  await expect(anonim.supply(wethTokenAddress, amount)).to.be.reverted;
              });
              it("not allowed other wethTokens", async function () {
                  const wethTokenAddress = "0xC297b516338A8e53A4C0063349266C8B0cfD07bF";
                  await wethToken.approve(anonim.address, amount);
                  await expect(anonim.supply(wethTokenAddress, amount)).to.be.revertedWith(
                      "Anonim__ThisTokenIsNotAvailable"
                  );
              });
              it("add to total supply & supply balances", async function () {
                  await wethToken.approve(anonim.address, amount);
                  await anonim.supply(wethTokenAddress, amount);
                  expect(await anonim.getTokenTotalSupply(wethTokenAddress)).to.equal(amount);
                  expect(await anonim.getSupplyBalance(wethTokenAddress, user.address)).to.equal(
                      amount
                  );
              });
              it("add suppliers & unique wethToken", async function () {
                  await wethToken.approve(anonim.address, amount);
                  await anonim.supply(wethTokenAddress, amount);
                  const suppliers = await anonim.getSuppliers();
                  const uniqueTokens = await anonim.getUniqueSupplierTokens(user.address);
                  assert.equal(suppliers[0], user.address);
                  assert.equal(uniqueTokens[0], wethTokenAddress);
              });
              it("not adds suppliers & unique wethToken in array twice", async function () {
                  await wethToken.approve(anonim.address, amount);
                  await anonim.supply(wethTokenAddress, amount);
                  await wethToken.approve(anonim.address, amount);
                  await anonim.supply(wethTokenAddress, amount);
                  const suppliers = await anonim.getSuppliers();
                  const uniqueTokens = await anonim.getUniqueSupplierTokens(user.address);
                  assert.equal(suppliers.length, 1);
                  assert.equal(uniqueTokens.length, 1);
              });
          });
          describe("withdraw", function () {
              //   let amount;
              beforeEach(async function () {
                  await wethToken.approve(anonim.address, amount);
                  //   amount = ethers.utils.parseEther("0.5");
              });
              it("reverts if not supplied", async function () {
                  await expect(anonim.withdraw(wethTokenAddress, amount)).to.be.revertedWith(
                      "Anonim__NotSupplied()"
                  );
              });
              it("reverts if asking to withdraw more than supplied", async function () {
                  const moreAmount = ethers.utils.parseEther("0.6");
                  await anonim.supply(wethTokenAddress, amount);
                  await expect(anonim.withdraw(wethTokenAddress, moreAmount)).to.be.revertedWith(
                      "CannotWithdrawMoreThanSupplied"
                  );
              });
              it("not withdraw full amount if u have borrowings", async function () {
                  await anonim.supply(wethTokenAddress, amount);
                  const borrowAmount = ethers.utils.parseEther("0.1");
                  await anonim.borrow(wethTokenAddress, borrowAmount);
                  await expect(anonim.withdraw(wethTokenAddress, amount)).to.be.revertedWith(
                      "Anonim__NotAllowedBeforeRepayingExistingLoan"
                  );
              });
              it("removes supllier & unique token on 0 balance", async function () {
                  await anonim.supply(wethTokenAddress, amount);
                  const withdrawAmount = ethers.utils.parseEther("0.5");
                  await anonim.withdraw(wethTokenAddress, withdrawAmount);
                  const suppliers = await anonim.getSuppliers();
                  const uniqueTokens = await anonim.getUniqueSupplierTokens(user.address);
                  assert(uniqueTokens.length === 0);
                  assert(suppliers.length === 0);
              });
              it("decreases total supply and supplier balance", async function () {
                  await anonim.supply(wethTokenAddress, amount);
                  const withdrawAmount = ethers.utils.parseEther("0.3");
                  await anonim.withdraw(wethTokenAddress, withdrawAmount);
                  expect(await anonim.getTokenTotalSupply(wethTokenAddress)).to.equal(
                      ethers.utils.parseEther("0.2")
                  );
                  expect(await anonim.getSupplyBalance(wethTokenAddress, user.address)).to.equal(
                      ethers.utils.parseEther("0.2")
                  );
              });
          });
          describe("borrow", async function () {
              let borrowAmount;
              beforeEach(async function () {
                  await wethToken.approve(anonim.address, amount);
                  await anonim.supply(wethTokenAddress, amount);
                  borrowAmount = ethers.utils.parseEther("0.3");
              });
              it("not allow more then 80 % to borrow", async function () {
                  await expect(
                      anonim.borrow(wethTokenAddress, ethers.utils.parseEther("0.41"))
                  ).to.be.revertedWith("Anonim__CouldNotBorrowMoreThan80PercentOfCollateral");
              });
              it("not allows if tries to borrow again more", async function () {
                  await anonim.borrow(wethTokenAddress, ethers.utils.parseEther("0.40"));
                  await expect(
                      anonim.borrow(wethTokenAddress, ethers.utils.parseEther("0.01"))
                  ).to.be.revertedWith("Anonim__CouldNotBorrowMoreThan80PercentOfCollateral");
              });
              it("adds borrower and unique token", async function () {
                  await anonim.borrow(wethTokenAddress, borrowAmount);
                  const borrowers = await anonim.getBorrowers();
                  const uniqueTokens = await anonim.getUniqueBorrowerTokens(user.address);
                  assert.equal(borrowers[0], user.address);
                  assert.equal(uniqueTokens[0], wethTokenAddress);
              });
              it("decreses from total supply and increases borrower balance", async function () {
                  await anonim.borrow(wethTokenAddress, borrowAmount);
                  const totalSupply = await anonim.getTokenTotalSupply(wethTokenAddress);
                  const borrowBalance = await anonim.getBorrowedBalance(
                      wethTokenAddress,
                      user.address
                  );
                  expect(totalSupply).to.equal(amount.sub(borrowAmount));
                  expect(borrowBalance).to.equal(borrowAmount);
              });
          });
          describe("repay", async function () {
              let borrowAmount, repayAmount;
              beforeEach(async function () {
                  await wethToken.approve(anonim.address, amount);
                  await anonim.supply(wethTokenAddress, amount);
                  borrowAmount = ethers.utils.parseEther("0.3");
                  await anonim.borrow(wethTokenAddress, borrowAmount);
              });
              it("adds balance in total supply and decreses from borrowed", async function () {
                  repayAmount = ethers.utils.parseEther("0.2");
                  await wethToken.approve(anonim.address, repayAmount);
                  await anonim.repay(wethTokenAddress, repayAmount);
                  const totalSupply = await anonim.getTokenTotalSupply(wethTokenAddress);
                  const borrowBalance = await anonim.getBorrowedBalance(
                      wethTokenAddress,
                      user.address
                  );
                  expect(totalSupply).to.equal(repayAmount.add(amount.sub(borrowAmount)));
                  expect(borrowBalance).to.equal(borrowAmount.sub(repayAmount));
              });
              it("remove borrower and uniqure token if balance is 0", async function () {
                  repayAmount = ethers.utils.parseEther("0.3");
                  await wethToken.approve(anonim.address, repayAmount);
                  await anonim.repay(wethTokenAddress, repayAmount);
                  const borrowers = await anonim.getBorrowers();
                  const uniqueTokens = await anonim.getUniqueBorrowerTokens(user.address);
                  assert(borrowers.length === 0);
                  assert(uniqueTokens.length === 0);
              });
          });
          describe("check upKeep", async function () {
              let interval;
              beforeEach(async function () {
                  interval = await anonim.getInterval();
                  await wethToken.approve(anonim.address, amount);
              });
              it("returns false if has no users", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await anonim.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("returns false if interval is NOT passed", async function () {
                  await anonim.supply(wethTokenAddress, amount);
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await anonim.callStatic.checkUpkeep([]);
                  assert(!upkeepNeeded);
              });
              it("returns true if interval is passed", async function () {
                  await anonim.supply(wethTokenAddress, amount);
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
                  const { upkeepNeeded } = await anonim.callStatic.checkUpkeep([]);
                  assert(upkeepNeeded);
              });
          });
          describe("perform upkeep", async function () {
              let borrowAmount, supplyAmount, interval;
              beforeEach(async function () {
                  interval = await anonim.getInterval();
                  supplyAmount = ethers.utils.parseEther("1000");
                  await wethToken.approve(anonim.address, supplyAmount);
                  await anonim.supply(wethTokenAddress, supplyAmount);
                  borrowAmount = ethers.utils.parseEther("100");
                  await anonim.borrow(wethTokenAddress, borrowAmount);
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.send("evm_mine", []);
              });
              it("charges 2 % APY per 30 sec to boroowers", async function () {
                  const beforeBorrowBalance = await anonim.getBorrowedBalance(
                      wethTokenAddress,
                      user.address
                  );
                  await anonim.performUpkeep([]);
                  const afterBorrowBalance = await anonim.getBorrowedBalance(
                      wethTokenAddress,
                      user.address
                  );
                  expect(afterBorrowBalance).to.equal(
                      beforeBorrowBalance.add(beforeBorrowBalance.div(50))
                  );
              });
              it("reward 1 % APY per 30 sec", async function () {
                  const beforeSupplyBalance = await anonim.getSupplyBalance(
                      wethTokenAddress,
                      user.address
                  );
                  await anonim.performUpkeep([]);
                  const afterSupplyBalance = await anonim.getSupplyBalance(
                      wethTokenAddress,
                      user.address
                  );
                  expect(afterSupplyBalance).to.equal(
                      beforeSupplyBalance.add(beforeSupplyBalance.div(100))
                  );
              });
          });

            // I tested this after switching OFF `notMoreThanMaxBorrow()` function, otherwise it will not work.

            // describe("liquidation", function () {
            //     beforeEach(async function () {
            //         await wethToken.approve(anonim.address, amount);
            //         await anonim.supply(wethTokenAddress, amount);
            //         await anonim.borrow(wethTokenAddress, amount);
            //     });
            //     it("only owner can call it", async function () {
            //         anonim = anonim.connect(user2);
            //         await expect(anonim.liquidation()).to.be.revertedWith(
            //             "Ownable: caller is not the owner"
            //         );
            //     });
            //     it("owner can liquidate collaterals if borrowing is more than supply", async function () {
            //         await anonim.liquidation();
            //         const borrowBlnc = await anonim.getBorrowedBalance(
            //             wethTokenAddress,
            //             user.address
            //         );
            //         const supplyBlnc = await anonim.getSupplyBalance(wethTokenAddress, user.address);
            //         assert(borrowBlnc == 0);
            //         assert(supplyBlnc == 0);
            //     });
            // });
      });
