import { Table, Button } from "web3uikit";
import Image from "next/image";
import { ethers } from "ethers";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import { useEffect, useState } from "react";
import RepayModal from "./RepayModal";

export default function BorrowsTable({ tokenBalances, tokenAddresses, tokenNames, isFetching }) {
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [data, setData] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [repayIndex, setRepayIndex] = useState(0);
    const [balanceInUsd, setBalanceInUsd] = useState("0");
    const [isLoading, setIsLoading] = useState(true);

    async function showTable() {
        try {
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            const borrowInUsd = await contract.getTotalBorrowValue(account);
            setBalanceInUsd(ethers.utils.formatEther(borrowInUsd));
            const rows = [];

            tokenNames.forEach(async (tokenName, i) => {
                const borrowBalance = ethers.utils.formatEther(
                    await contract.getBorrowedBalance(tokenAddresses[i], account)
                );
                if (borrowBalance > 0) {
                    rows.push([
                        <Image src={`/${tokenName.toLowerCase()}.svg`} height="45" width="45" />,
                        tokenName.toUpperCase().toString(),
                        parseFloat(borrowBalance).toFixed(2),
                        "2% / 30 sec",
                        <Button
                            text="Repay"
                            theme="primary"
                            type="button"
                            size="regular"
                            onClick={() => {
                                setRepayIndex(i);
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
            console.log("This error is coming from `BorrowsTable` showTable");
        }
    }

    async function updateUI() {
        await showTable();
    }

    useEffect(() => {
        if (isWeb3Enabled && !isFetching) {
            updateUI();
            console.log("Updating UI!");
        }
    }, [isWeb3Enabled]);

    return (
        <div>
            <div className="p-4 font-semibold text-2xl text-gray-500">Your Borrows</div>
            <div className="p-2 font-medium text-gray-500">
                Balance ${parseFloat(balanceInUsd).toFixed(2)}
            </div>
            <Table
                columnsConfig="80px 3fr 2fr 2fr 100px"
                data={data}
                header={["", <span>Assets</span>, <span>Debt</span>, <span>APY</span>, ""]}
                customNoDataComponent={<p>Nothing borrowed yet</p>}
                maxPages={1}
                pageSize={8}
                isLoading={isLoading}
            />
            <RepayModal
                isVisible={showModal}
                onClose={() => setShowModal(false)}
                repayIndex={repayIndex}
                tokenBalances={tokenBalances}
                tokenAddresses={tokenAddresses}
                tokenNames={tokenNames}
            />
        </div>
    );
}
