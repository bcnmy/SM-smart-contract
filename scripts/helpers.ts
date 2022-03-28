import { run, ethers, upgrades } from "hardhat";
import { BigNumberish, Contract, ContractFactory } from "ethers";
import { initializeBicoVault } from "./deploy-bicoEco";

import {
    BicoProtocolEcosystemReserve,
    StakedTokenV3
    // eslint-disable-next-line node/no-missing-import
} from "../typechain";

interface IDeployConfig {
    stakedToken: string,
    rewardToken: string,
    cooldownSeconds: number,
    unstakeWindow: number,
    rewardsVault: string,
    emissionManager: string,
    distributionDuration: number,
    name: string,
    symbol: string,
    decimals: number,
    governance: string,
    trustedForwarder: string
}

interface IContracts {
    // bicoRewardVault: BicoProtocolEcosystemReserve;
    bicoStaking: StakedTokenV3;
}

const wait = (time: number) : Promise<void> => {
    return new Promise((resolve)=>{
      setTimeout(resolve, time);
    });
}

const deploy = async (deployConfig: IDeployConfig) => {
    const contracts = await deployCoreContracts(deployConfig);
  
    // await configure(contracts, deployConfig.bicoOwner);
    await verify(contracts);
};

async function deployCoreContracts(deployConfig: IDeployConfig): Promise<any> {
  try{

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Deploy Bico Reward vault
    // const BicoProtocolEcosystemReserve = await ethers.getContractFactory("BicoProtocolEcosystemReserve");
    // console.log("Deploying BicoProtocolEcosystemReserve...");
    // const bicoRewardVault = (await upgrades.deployProxy(BicoProtocolEcosystemReserve,[
    //   deployConfig.emissionManager
    // ])) as BicoProtocolEcosystemReserve;
    // await bicoRewardVault.deployed();

    // console.log("bicoRewardVault Proxy deployed to:", bicoRewardVault.address);
    // await wait(5000);

    // return { bicoRewardVault };
    console.log(JSON.stringify(deployConfig));
    const StakedTokenV3 = await ethers.getContractFactory("StakedTokenV3");
    console.log("Deploying StakedTokenV3...");
    const bicoStaking = (await upgrades.deployProxy(
      StakedTokenV3, [
      // stakedToken: deployConfig.stakedToken,
      // deployConfig.rewardToken,
      // deployConfig.cooldownSeconds,
      // deployConfig.unstakeWindow,
      // "0x7E3EC659C65b48FC74e528f81774D31E5A1dA8F9",
      // deployConfig.emissionManager,
      // deployConfig.distributionDuration,
      // deployConfig.name,
      // deployConfig.symbol,
      // deployConfig.decimals,
      // deployConfig.governance
    ])) as StakedTokenV3;
    await bicoStaking.deployed();

    console.log("bicoStaking Proxy deployed to:", bicoStaking.address);
    await wait(5000);

    return { bicoStaking };
  } catch (error){
    console.log(error);
    return null;
  }
}

// const configure = async (contracts: IContracts, bicoOwner: string) => {
//     await wait(5000);
//     await (await contracts.liquidityProviders.setTokenManager(contracts.tokenManager.address)).wait();
// }

const getImplementationAddress = async (proxyAddress: string) => {
    return ethers.utils.hexlify(
      ethers.BigNumber.from(
        await ethers.provider.send("eth_getStorageAt", [
          proxyAddress,
          "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
          "latest",
        ])
      )
    );
};

const verifyImplementation = async (address: string) => {
    try {
      await run("verify:verify", {
        address: await getImplementationAddress(address),
      });
    } catch (e) {
      console.log(`Failed to verify Contract ${address} `, e);
    }
};

const verify = async (
    contracts: IContracts
  ) => {
    console.log("Verifying Contracts...");
    
    // await verifyImplementation(contracts.bicoRewardVault.address);
    await verifyImplementation("0xe9Dcaab861cf77b94Bf56887e9a2df82D60992BA");
    
}

export {
    IDeployConfig, deploy
};