// let ABI = [ "function transfer(address to, uint amount)" ];
const { ethers } = require("hardhat");
let ABI = [ { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "fundsAdmin", "type": "address" } ], "name": "NewFundsAdmin", "type": "event" }, { "inputs": [], "name": "REVISION", "outputs": [ { "internalType": "uint256", "name": "", "type": "uint256" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "contract IERC20", "name": "token", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [], "name": "getFundsAdmin", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "reserveController", "type": "address" } ], "name": "initialize", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "admin", "type": "address" } ], "name": "setFundsAdmin", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "internalType": "contract IERC20", "name": "token", "type": "address" }, { "internalType": "address", "name": "recipient", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "transfer", "outputs": [], "stateMutability": "nonpayable", "type": "function" } ];
	
async function initializeBicoVault(EMISSION_MANAGER: string){
	let iface = new ethers.utils.Interface(ABI);
	let encodeValue = iface.encodeFunctionData("initialize", [
		EMISSION_MANAGER
	]);
	return encodeValue;
}

export { initializeBicoVault }