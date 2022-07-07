const { network } = require("hardhat");
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deployer } = await getNamedAccounts();
    const { deploy, log } = deployments;
    const waitConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS;

    log("-------------------------------------");
    log("deploying BTC");

    const wbtc = await deploy("WBTC", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitConfirmations,
    });

    log("-------------------------------------");
    log("deploying Weth");

    const weth = await deploy("WETH", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitConfirmations,
    });

    log("-------------------------------------");
    log("deploying Dai");

    const dai = await deploy("DAI", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitConfirmations,
    });


    log("-------------------------------------");
    log("deploying USDC");

    const usdc = await deploy("USDC", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitConfirmations,
    });


    log("-------------------------------------");
    log("deploying AnonimToken");

    const ant = await deploy("ANT", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations: waitConfirmations,
    });


    const tokenAddresses = [wbtc.address, weth.address, dai.address, usdc.address, ant.address];
    log("---------------------------------");
    console.log("Here are all token addresses", tokenAddresses);
};

module.exports.tags = ["all", "tokens"];
