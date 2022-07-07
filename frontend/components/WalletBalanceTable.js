import { Table, Button, Checkbox, Icon } from "web3uikit";
import Image from "next/image";
import { useMoralis } from "react-moralis";
import { useEffect, useState } from "react";
import SupplyModal from "./SupplyModal";

export default function WalletBalanceTable({ tokenBalances, tokenAddresses, tokenNames }) {
    const { isWeb3Enabled, chainId, account } = useMoralis();
    const [isFetching, setIsFetching] = useState(true);
    const [data, setData] = useState([]);
    const [showOtherAssets, setShowOtherAssets] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [switchedOn, setSwitchedOn] = useState(false);
    const [index, setIndex] = useState(0);

    async function showTable() {
        const rows = [];
        try {
            tokenNames.forEach((tokenName, i) => {
                if (tokenBalances[tokenName] > 0) {
                    rows.push([
                        <Image src={`/${tokenName.toLowerCase()}.svg`} height="45" width="45" />,
                        tokenName.toUpperCase().toString(),
                        parseFloat(tokenBalances[tokenName]).toFixed(2),
                        "1% / 30 sec",
                        <Icon fill="#008000" size={24} svg="check" />,
                        <Button
                            text="Supply"
                            theme="primary"
                            type="button"
                            size="regular"
                            onClick={() => {
                                setIndex(i);
                                setShowModal(true);
                            }}
                        />,
                    ]);
                }
            });
            tokenNames.forEach((tokenName) => {
                if (showOtherAssets && tokenBalances[tokenName] <= 0) {
                    rows.push([
                        <Image src={`/${tokenName.toLowerCase()}.svg`} height="45" width="45" />,
                        tokenName.toUpperCase().toString(),
                        tokenBalances[tokenName],
                        "1% / 30 sec",
                        <Icon fill="#008000" size={24} svg="check" />,
                        <Button
                            text="Supply"
                            theme="primary"
                            type="button"
                            size="regular"
                            disabled={true}
                        />,
                    ]);
                }
            });

            setData(rows);
            setIsFetching(false);
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `WalletBalancrTable` showTable");
        }
    }

    async function updateUI() {
        await showTable();
    }

    async function handleSwitching() {
        if (switchedOn) {
            // it is on and we r switching off
            setSwitchedOn(false);
            setShowOtherAssets(false);
        } else {
            setSwitchedOn(true);
            setShowOtherAssets(true);
        }
    }

    useEffect(() => {
        console.log("Updating UI!");
        updateUI();
    }, [isWeb3Enabled, showOtherAssets]);

    return (
        <div>
            <div className="p-6 font-semibold text-2xl text-gray-500">Assets to Supply</div>
            <Checkbox
                id="show-all-assets"
                label="Show assets with 0 balance"
                layout="switch"
                name="Show other assets"
                onChange={(e) => {
                    handleSwitching();
                }}
            />
            <div>
                <Table
                    columnsConfig="80px 2fr 2fr 2fr 2fr 100px"
                    data={data}
                    header={[
                        "",
                        <span>Assets</span>,
                        <span>Wallet Balance</span>,
                        <span>APY</span>,
                        <span>Can be collateral</span>,
                        "",
                    ]}
                    pageSize={8}
                    isLoading={isFetching}
                />
            </div>
            <SupplyModal
                isVisible={showModal}
                onClose={() => setShowModal(false)}
                index={index}
                tokenBalances={tokenBalances}
                tokenAddresses={tokenAddresses}
                tokenNames={tokenNames}
            />
        </div>
    );
}
