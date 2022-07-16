import { Table, Button } from "web3uikit";
import Image from "next/image";
import { ethers } from "ethers";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import { useEffect, useState } from "react";
import BorrowModal from "./BorrowModal";

export default function AvailableBorrowTable({
    tokenBalances,
    tokenAddresses,
    tokenNames,
    isFetching,
}) {
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [borrowIndex, setBorrowIndex] = useState(0);

    async function showTable() {
        try {
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            const supplyInUsd = await contract.getTotalSupplyValue(account);
            const rows = [];

            tokenNames.forEach(async (tokenName, i) => {
                const availableTokens =
                    supplyInUsd != 0
                        ? await contract.getMaxTokenBorrow(tokenAddresses[i], account)
                        : "0";
                rows.push([
                    <Image src={`/${tokenName.toLowerCase()}.svg`} height="45" width="45" />,
                    tokenName.toUpperCase().toString(),
                    parseFloat(ethers.utils.formatEther(availableTokens)).toFixed(2),
                    "2% / 30 sec",
                    <Button
                        text="Borrow"
                        theme="primary"
                        type="button"
                        size="regular"
                        disabled={availableTokens > 0 ? false : true}
                        onClick={() => {
                            setBorrowIndex(i);
                            setShowModal(true);
                        }}
                    />,
                ]);
            });
            setData(rows);
            setIsLoading(false);
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `AvailableBorrowTable` showTable");
        }
    }

    async function updateUI() {
        await showTable();
    }

    useEffect(() => {
        if (isWeb3Enabled && !isFetching) {
            updateUI();
        }
    }, [isWeb3Enabled]);

    return (
        <div>
            <div className="p-12 pt-6 font-semibold text-2xl text-gray-500">Assets to Borrow</div>
            <Table
                columnsConfig="80px 3fr 2fr 2fr 100px"
                data={data}
                header={["", <span>Assets</span>, <span>Available</span>, <span>APY</span>, ""]}
                maxPages={1}
                pageSize={8}
                isLoading={isLoading}
            />
            <BorrowModal
                isVisible={showModal}
                onClose={() => setShowModal(false)}
                borrowIndex={borrowIndex}
                tokenBalances={tokenBalances}
                tokenAddresses={tokenAddresses}
                tokenNames={tokenNames}
            />
        </div>
    );
}
