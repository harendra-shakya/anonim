import { useEffect, useState } from "react";
import { Modal, Icon, useNotification, Input } from "web3uikit";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import { ethers, utils } from "ethers";

export default function BorrowModal({
    isVisible,
    onClose,
    borrowIndex,
    tokenBalances,
    tokenAddresses,
    tokenNames,
}) {
    const [borrowAmount, setBorrowAmount] = useState("0");
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [isOkDisabled, setIsOkDisabled] = useState(false);
    const [availableTokens, setAvailableTokens] = useState("0");
    const dispatch = useNotification();

    async function updateUI() {
        const { ethereum } = window;
        const provider = await new ethers.providers.Web3Provider(ethereum);
        const signer = await provider.getSigner();
        const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
        const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
        const availableTokens = await contract.getMaxTokenBorrow(
            tokenAddresses[borrowIndex],
            account
        );
        setAvailableTokens(ethers.utils.formatEther(availableTokens));
    }

    async function borrow() {
        try {
            if (+availableTokens < +borrowAmount) {
                alert("You can only borrow 80% of your collateral!");
                return;
            }
            setIsOkDisabled(true);
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            console.log("Borrowing...");
            const tx = await contract.borrow(
                tokenAddresses[borrowIndex],
                ethers.utils.parseEther(borrowAmount)
            );
            const txReceipt = await tx.wait(1);
            if (txReceipt.status === 1) {
                console.log("Borrowed!");
                setIsOkDisabled(false);
                handleBorrowSuccess();
            } else {
                alert("Transaction Failed for some reason. Please try again!");
                setIsOkDisabled(false);
            }
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `BorrowModal` borrow function");
            setIsOkDisabled(false);
        }
    }

    const handleBorrowSuccess = async function () {
        onClose && onClose();
        dispatch({
            type: "success",
            title: "Asset Borrowed!",
            message: "Asset Borrowed - Please Refresh",
            position: "topR",
        });
    };

    useEffect(() => {
        updateUI();
    }, [isWeb3Enabled, borrowAmount, tokenBalances]);

    return (
        <div className="pt-2">
            <Modal
                isVisible={isVisible}
                onCancel={onClose}
                onCloseButtonPressed={onClose}
                onOk={borrow}
                title={`Borrow ${tokenNames[borrowIndex].toUpperCase()}`}
                width="450px"
                isCentered={true}
                isOkDisabled={isOkDisabled}
            >
                <div
                    style={{
                        alignItems: "center",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                    }}
                >
                    <Input
                        label="Amount"
                        name="Amount"
                        type="text"
                        onChange={(event) => {
                            setBorrowAmount(event.target.value);
                        }}
                    />
                </div>
                <div className="p-1 text-right">Max: {availableTokens}</div>
                <div className="pt-4 p-1">Transaction Overview</div>
                <div className="py-3 pl-12 border-2 grid grid-cols-2 gap-3 place-content-stretch h-35">
                    <div className="pr-6">Borrow APY:</div>
                    <div>2% / 30 sec</div>
                    <div>Remaining Available Borrow:</div>
                    <div>{availableTokens - borrowAmount}</div>
                </div>
                <div className="pb-12"></div>
            </Modal>
        </div>
    );
}
