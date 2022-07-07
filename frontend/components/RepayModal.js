import { useEffect, useState } from "react";
import { Modal, Icon, useNotification, Input } from "web3uikit";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import erc20Abi from "../constants/Weth.json";
import { ethers } from "ethers";

export default function RepayModal({
    isVisible,
    onClose,
    repayIndex,
    tokenBalances,
    tokenAddresses,
    tokenNames,
}) {
    const [repayAmount, setRepayAmount] = useState("0");
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [isOkDisabled, setIsOkDisabled] = useState(false);
    const [totalDebt, setTotalDebt] = useState("0");
    const dispatch = useNotification();

    async function repay() {
        try {
            if (+totalDebt < +repayAmount) {
                alert("Please do not enter more than your debt! It's your loss :)");
                return;
            }
            setIsOkDisabled(true);
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            const erc20 = await new ethers.Contract(tokenAddresses[repayIndex], erc20Abi, signer);
            console.log("Approving");
            // prettier-ignore
            const approve = await erc20.approve(contractAddress, ethers.utils.parseEther(repayAmount), {
                "from": account,
            });
            console.log("Waiting for confirmations");
            const approveReceipt = await approve.wait(1);
            console.log("approveReceipt", approveReceipt);
            if (approveReceipt.status !== 1) {
                alert("Tx Failed! Plz try again");
                setIsOkDisabled(false);
                return;
            }
            const tx = await contract.repay(
                tokenAddresses[repayIndex],
                ethers.utils.parseEther(repayAmount)
            );
            console.log("Repaying");
            const txReceipt = await tx.wait(1);
            if (txReceipt.status === 1) {
                console.log("Repaid!");
                setIsOkDisabled(false);
                handleRepaySuccess();
            }
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `RepayModal` repay function");
            setIsOkDisabled(false);
        }
    }

    const handleRepaySuccess = async function () {
        onClose && onClose();
        dispatch({
            type: "success",
            title: "Asset Repaid!",
            message: "Asset Repaid - Please Refresh",
            position: "topR",
        });
    };

    async function updateUI() {
        const { ethereum } = window;
        const provider = await new ethers.providers.Web3Provider(ethereum);
        const signer = await provider.getSigner();
        const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
        const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
        const debt = await contract.getBorrowedBalance(tokenAddresses[repayIndex], account);
        setTotalDebt(ethers.utils.formatEther(debt));
    }

    useEffect(() => {
        updateUI();
    }, [isWeb3Enabled, repayAmount, tokenBalances]);

    return (
        <div className="pt-2">
            <Modal
                isVisible={isVisible}
                onCancel={onClose}
                onCloseButtonPressed={onClose}
                onOk={repay}
                title={`Repay ${tokenNames[repayIndex].toUpperCase()}`}
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
                            setRepayAmount(event.target.value);
                        }}
                    />
                </div>
                <div className="p-1 text-right">Max: {totalDebt}</div>
                <div className="pt-4 p-1">Transaction Overview</div>
                <div className="py-3 pl-12 border-2 grid grid-cols-2 gap-3 place-content-stretch h-35">
                    <div>Remaining Borrowings:</div>
                    <div>{totalDebt - repayAmount}</div>
                </div>
                <div className="pb-12"></div>
            </Modal>
        </div>
    );
}
