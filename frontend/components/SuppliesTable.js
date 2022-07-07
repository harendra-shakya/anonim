import { Table, Button, Icon } from "web3uikit";
import Image from "next/image";
import { ethers } from "ethers";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import { useEffect, useState } from "react";
import WithdrawModal from "./WithdrawModal";

export default function SuppliesTable({ tokenBalances, tokenAddresses, tokenNames, isFetching }) {
    const { isWeb3Enabled, chainId, account } = useMoralis();
    const [data, setData] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [suppliesIndex, setSuppliesIndex] = useState(0);
    const [balanceInUsd, setBalanceInUsd] = useState("0");
    const [isLoading, setIsLoading] = useState(true);

    async function showTable() {
        try {
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            const supplyInUsd = await contract.getTotalSupplyValue(account);
            setBalanceInUsd(ethers.utils.formatEther(supplyInUsd));
            const rows = [];

            tokenNames.forEach(async (tokenName, i) => {
                const supplyBalance = await contract.getSupplyBalance(tokenAddresses[i], account);
                if (supplyBalance > 0) {
                    rows.push([
                        <Image src={`/${tokenName.toLowerCase()}.svg`} height="45" width="45" />,
                        tokenName.toUpperCase().toString(),
                        parseFloat(ethers.utils.formatEther(supplyBalance)).toFixed(2),
                        "1% / 30 sec",
                        <Icon fill="#008000" size={24} svg="check" />,
                        <Button
                            text="Withdraw"
                            theme="primary"
                            type="button"
                            size="regular"
                            onClick={() => {
                                setSuppliesIndex(i);
                                setShowModal(true);
                            }}
                        />,
                    ]);
                }
            });
            setData(rows);
            setIsLoading(false);
        } catch (e) {
            console.log(e);
            console.log("This error is coming from SuppliesTable showTable ");
        }
    }

    async function updateUI() {
        await showTable();
    }

    useEffect(() => {
        if (isWeb3Enabled && !isFetching) {
            console.log("Updating UI!");
            updateUI();
        }
    }, [isWeb3Enabled]);

    return (
        <div>
            <div className="p-4 font-semibold text-2xl text-gray-500">Your Supplies</div>
            <div className="p-2 font-medium text-gray-500">
                Balance ${parseFloat(balanceInUsd).toFixed(2)}
            </div>
            <div>
                <Table
                    columnsConfig="80px 2fr 2fr 2fr 2fr 100px"
                    data={data}
                    header={[
                        "",
                        <span>Assets</span>,
                        <span>Balance</span>,
                        <span>APY</span>,
                        <span>Collateral</span>,
                        "",
                    ]}
                    customNoDataComponent={<p>Nothing supplied yet</p>}
                    pageSize={8}
                    isLoading={isLoading}
                />
            </div>
            <WithdrawModal
                isVisible={showModal}
                onClose={() => setShowModal(false)}
                tokenBalances={tokenBalances}
                tokenAddresses={tokenAddresses}
                tokenNames={tokenNames}
                suppliesIndex={suppliesIndex}
            />
        </div>
    );
}
