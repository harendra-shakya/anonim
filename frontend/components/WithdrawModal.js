import { useEffect, useState } from "react";
import { Modal, Icon, useNotification, Input } from "web3uikit";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import { ethers, utils } from "ethers";

export default function WithdrawModal({
    isVisible,
    onClose,
    tokenBalances,
    tokenAddresses,
    tokenNames,
    suppliesIndex,
}) {
    const [withdrawAmount, setWithdrawAmount] = useState("0");
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [isOkDisabled, setIsOkDisabled] = useState(false);
    const [tokenSupply, setTokenSupply] = useState("0");
    const dispatch = useNotification();

    async function updateUI() {
        const { ethereum } = window;
        const provider = await new ethers.providers.Web3Provider(ethereum);
        const signer = await provider.getSigner();
        const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
        const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
        const supply = await contract.getMaxWithdraw(tokenAddresses[suppliesIndex], account);
        setTokenSupply(ethers.utils.formatEther(supply));
    }

    async function withdraw() {
        try {
            if (+tokenSupply < +withdrawAmount) {
                alert("Please do not enter more than your supply!");
                return;
            }
            setIsOkDisabled(true);
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            console.log("Withdrawing");
            const tx = await contract.withdraw(
                tokenAddresses[suppliesIndex],
                ethers.utils.parseEther(withdrawAmount)
            );
            const txReceipt = await tx.wait(1);
            if (txReceipt.status === 1) {
                console.log("Supplied!");
                setIsOkDisabled(false);
                handleWithdrawSuccess();
            } else {
                alert("Transaction Failed for some reason. Please try again!");
                setIsOkDisabled(false);
            }
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `SupplyModal` supply function");
            setIsOkDisabled(false);
        }
    }

    const handleWithdrawSuccess = async function () {
        onClose && onClose();
        dispatch({
            type: "success",
            title: "Asset Withdrawn!",
            message: "Asset Withdrawn - Please Refresh",
            position: "topR",
        });
    };

    useEffect(() => {
        updateUI();
    }, [isWeb3Enabled, withdrawAmount, tokenBalances]);

    return (
        <div className="pt-2">
            <Modal
                isVisible={isVisible}
                onCancel={onClose}
                onCloseButtonPressed={onClose}
                onOk={withdraw}
                title={`Withdraw ${tokenNames[suppliesIndex].toUpperCase()}`}
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
                            setWithdrawAmount(event.target.value);
                        }}
                    />
                </div>
                <div className="p-1 text-right">Max: {tokenSupply}</div>
                <div className="pt-4 p-1">Transaction Overview</div>
                <div className="py-3 pl-12 border-2 grid grid-cols-2 gap-3 place-content-stretch h-35">
                    <div>Remaining Supply:</div>
                    <div>{tokenSupply - withdrawAmount}</div>
                </div>
                <div className="pb-12"></div>
            </Modal>
        </div>
    );
}
