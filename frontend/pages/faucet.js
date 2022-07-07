import { Table, Button, useNotification } from "web3uikit";
import Image from "next/image";
import { ethers } from "ethers";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import { useEffect, useState } from "react";

export default function faucet() {
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const tokenAddresses = [];
    const tokenNames = ["WBTC", "WETH", "DAI", "USDC", "ANT"];
    const dispatch = useNotification();

    async function getTokenAddreses() {
        for (let token of tokenNames) {
            tokenAddresses.push(contractAddresses[token][parseInt(chainId)][0]);
        }
    }

    async function showTable() {
        try {
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            const rows = [];

            tokenNames.forEach(async (tokenName, i) => {
                console.log(tokenName);
                rows.push([
                    "",
                    <Image src={`/${tokenName.toLowerCase()}.svg`} height="45" width="45" />,
                    tokenName.toUpperCase().toString(),
                    <Button
                        text={`Give me some ${tokenName.toUpperCase()}`}
                        theme="primary"
                        type="button"
                        size="regular"
                        onClick={async () => {
                            const tx = await contract.faucet(tokenAddresses[i]);
                            const txReceipt = await tx.wait();
                            if (txReceipt.status === 1) {
                                handleFaucetSuccess();
                            } else {
                                alert("Transfer Failed :( - try again");
                            }
                        }}
                    />,
                    "",
                ]);
            });
            setIsLoading(false);
            setData(rows);
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `BorrowsTable` showTable");
        }
    }

    const handleFaucetSuccess = async function () {
        dispatch({
            type: "success",
            title: "Tokens Received!",
            message: "Thank me later :)",
            position: "topR",
        });
    };

    async function updateUI() {
        await getTokenAddreses();
        await showTable();
    }

    useEffect(() => {
        if (isWeb3Enabled && chainId == 4) {
            updateUI();
            console.log("Updating UI!");
        }
    }, [isWeb3Enabled]);

    return (
        <div>
            {isWeb3Enabled ? (
                <div>
                    {chainId == 4 ? (
                        !isLoading ? (
                            <div className="p-4 ">
                                <div className="p-6 font-semibold text-3xl text-gray-500">
                                    Faucet
                                </div>
                                <Table
                                    columnsConfig="10px 120px 3fr 200px 10px"
                                    data={data}
                                    header={["", "", <span>Assets</span>, "", ""]}
                                    maxPages={1}
                                    pageSize={8}
                                />
                            </div>
                        ) : (
                            <div>Loading....</div>
                        )
                    ) : (
                        <div>Plz Connect to Rinkeby testnet</div>
                    )}
                </div>
            ) : (
                <div>Please Connect Your Wallet</div>
            )}
        </div>
    );
}
