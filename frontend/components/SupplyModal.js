import { useState } from "react";
import { Modal, Icon, useNotification, Input } from "web3uikit";
import anonimAbi from "../constants/Anonim.json";
import contractAddresses from "../constants/networkMapping.json";
import { useMoralis } from "react-moralis";
import erc20Abi from "../constants/Weth.json";
import { ethers } from "ethers";

export default function SupplyModal({
    isVisible,
    onClose,
    index,
    tokenBalances,
    tokenAddresses,
    tokenNames,
}) {
    const [supplyAmount, setSupplyAmount] = useState("0");
    const { isWeb3Enabled, account, chainId } = useMoralis();
    const [isOkDisabled, setIsOkDisabled] = useState(false);
    const dispatch = useNotification();

    async function supply() {
        try {
            if (+tokenBalances[tokenNames[index]] < +supplyAmount) {
                alert("Please do not enter more than your balance!");
                return;
            }
            setIsOkDisabled(true);
            const { ethereum } = window;
            const provider = await new ethers.providers.Web3Provider(ethereum);
            const signer = await provider.getSigner();
            const contractAddress = await contractAddresses["Anonim"][parseInt(chainId)][0];
            const contract = await new ethers.Contract(contractAddress, anonimAbi, signer);
            const erc20 = await new ethers.Contract(tokenAddresses[index], erc20Abi, signer);
            console.log("Approving");
            // prettier-ignore
            const approve = await erc20.approve(contractAddress, ethers.utils.parseEther(supplyAmount), {
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
            const tx = await contract.supply(
                tokenAddresses[index],
                ethers.utils.parseEther(supplyAmount)
            );
            console.log("Supplying");
            const txReceipt = await tx.wait(1);
            if (txReceipt.status === 1) {
                console.log("Supplied!");
                setIsOkDisabled(false);
                handleSupplySuccess();
            }
        } catch (e) {
            console.log(e);
            console.log("This error is coming from `SupplyModal` supply function");
        }
    }

    const handleSupplySuccess = async function () {
        onClose && onClose();
        dispatch({
            type: "success",
            title: "Asset Supplied!",
            message: "Asset Supplied - Please Refresh",
            position: "topR",
        });
    };

    return (
        <div className="pt-2">
            <Modal
                isVisible={isVisible}
                onCancel={onClose}
                onCloseButtonPressed={onClose}
                onOk={supply}
                title={`Supply ${tokenNames[index].toUpperCase()}`}
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
                            setSupplyAmount(event.target.value);
                        }}
                    />
                </div>
                <div className="p-1 text-right">Max: {tokenBalances[tokenNames[index]]}</div>
                <div className="pt-4 p-1">Transaction Overview</div>
                <div className="py-3 pl-12 border-2 grid grid-cols-2 gap-3 place-content-stretch h-35">
                    <div className="pr-6">Supply APY:</div>
                    <div>1% / 30 sec</div>
                    <div>Collateralization</div>
                    <div className="pr-12">
                        <Icon fill="#008000" size={24} svg="check" />
                    </div>
                </div>
                <div className="pb-12"></div>
            </Modal>
        </div>
    );
}
