const { ethers, network } = require("hardhat");
const fs = require("fs");

const frontEndContractsFile = "../frontend/constants/networkMapping.json";
const frontEndAbiLocation = "../frontend/constants/";

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        await updateAbi();
        await updateContractAddresses();
        console.log("Updated Frontend!!");
    }
};

async function updateAbi() {
    const anonim = await ethers.getContract("Anonim");
    const weth = await ethers.getContract("WETH");
    const contracts = [anonim, weth];
    const strings = ["Anonim.json", "Weth.json"];

    for (let i = 0; i < contracts.length; i++) {
        fs.writeFileSync(
            frontEndAbiLocation + strings[i],
            contracts[i].interface.format(ethers.utils.FormatTypes.json)
        );
    }
}

async function updateContractAddresses() {
    const anonim = await ethers.getContract("Anonim");
    const weth = await ethers.getContract("WETH");
    const wbtc = await ethers.getContract("WBTC");
    const dai = await ethers.getContract("DAI");
    const usdc = await ethers.getContract("USDC");
    const ant = await ethers.getContract("ANT");
    const chainId = network.config.chainId;
    const contractAddress = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf8"));

    const addresses = [
        anonim.address,
        wbtc.address,
        weth.address,
        dai.address,
        usdc.address,
        ant.address,
    ];
    const strings = ["Anonim", "WBTC", "WETH", "DAI", "USDC", "ANT"];

    for (let i = 0; i < addresses.length; i++) {
        contractAddress[strings[i]] = { [chainId]: [addresses[i]] };
    }

    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddress));
}

module.exports.tags = ["all", "frontend"];
