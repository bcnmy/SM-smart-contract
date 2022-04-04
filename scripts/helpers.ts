import { run, ethers, upgrades } from "hardhat";
import { BigNumberish, Contract, ContractFactory } from "ethers";
import { initializeBicoVault } from "./deploy-bicoEco";

import {
    BicoProtocolEcosystemReserve,
    StakedTokenV3
    // eslint-disable-next-line node/no-missing-import
} from "../typechain";

interface IStakingConfig {
  stakedToken: string,
  name: string,
  symbol: string,
  emissionPerSecond: string,
  totalSupply: string
}

interface IDeployConfig {
    bicoStaking: IStakingConfig[],
    rewardToken: string,
    cooldownSeconds: number,
    unstakeWindow: number,
    rewardsVault: string,
    emissionManager: string,
    distributionDuration: number,
    
    decimals: number,
    governance: string,
    trustedForwarder: string
}

interface IContracts {
    bicoRewardVault: BicoProtocolEcosystemReserve;
    bicoStaking: StakedTokenV3;
    bbptStaking: StakedTokenV3;
}

const wait = (time: number) : Promise<void> => {
    return new Promise((resolve)=>{
      setTimeout(resolve, time);
    });
}

const deploy = async (deployConfig: IDeployConfig) => {
    const contracts = await deployCoreContracts(deployConfig);
  
    // await configure(contracts, deployConfig, deployConfig.bicoOwner);
    await verify(contracts, deployConfig);
};

async function deployCoreContracts(deployConfig: IDeployConfig): Promise<any> {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    /* Deploy Bico Reward vault */
    const BicoProtocolEcosystemReserve = await ethers.getContractFactory("BicoProtocolEcosystemReserve");
    console.log("Deploying BicoProtocolEcosystemReserve...");
    const bicoRewardVault = (await upgrades.deployProxy(
      BicoProtocolEcosystemReserve,
      [
        deployConfig.emissionManager
      ]
    )) as BicoProtocolEcosystemReserve;
    await bicoRewardVault.deployed();

    console.log("bicoRewardVault Proxy deployed to:", bicoRewardVault.address);
    await wait(5000);

    console.log(JSON.stringify(deployConfig));
    const StakedTokenV3 = await ethers.getContractFactory("StakedTokenV3");
    console.log("Deploying BicoStaking Contract...");
    const bicoStaking = (await upgrades.deployProxy(
      StakedTokenV3, 
      [
          deployConfig.bicoStaking[0].name,
          deployConfig.bicoStaking[0].symbol,
          deployConfig.decimals,
          deployConfig.trustedForwarder
      ],
      { constructorArgs: [
          deployConfig.bicoStaking[0].stakedToken,
          deployConfig.rewardToken,
          deployConfig.cooldownSeconds,
          deployConfig.unstakeWindow,
          bicoRewardVault.address,
          deployConfig.emissionManager,
          deployConfig.distributionDuration,
          deployConfig.bicoStaking[0].name,
          deployConfig.bicoStaking[0].symbol,
          deployConfig.decimals,
          deployConfig.governance
        ],
        unsafeAllow: ["state-variable-assignment","state-variable-immutable","constructor"]
      },
    )) as StakedTokenV3;
    
    await bicoStaking.deployed();
    console.log("bicoStaking Proxy deployed to:", bicoStaking.address);
    await wait(5000);
    
    //BBPT staking deploy 
    console.log("Deploying Bbpt Staking Contract...");
    const bbptStaking = (await upgrades.deployProxy(
      StakedTokenV3, 
      [
          deployConfig.bicoStaking[1].name,
          deployConfig.bicoStaking[1].symbol,
          deployConfig.decimals,
          deployConfig.trustedForwarder
      ],
      { constructorArgs: [
          deployConfig.bicoStaking[1].stakedToken,
          deployConfig.rewardToken,
          deployConfig.cooldownSeconds,
          deployConfig.unstakeWindow,
          bicoRewardVault.address,
          deployConfig.emissionManager,
          deployConfig.distributionDuration,
          deployConfig.bicoStaking[1].name,
          deployConfig.bicoStaking[1].symbol,
          deployConfig.decimals,
          deployConfig.governance
        ],
        unsafeAllow: ["state-variable-assignment","state-variable-immutable","constructor"]
      },
    )) as StakedTokenV3;

    await bbptStaking.deployed();
    console.log("bbptStaking Proxy deployed to:", bbptStaking.address);
    await wait(5000);

    return { bicoRewardVault, bicoStaking, bbptStaking };
}

const configure = async (contracts: IContracts, deployConfig: IDeployConfig, bicoOwner: string) => {
    await wait(5000);
    //assetConfigure in BicoStaking
    await (await contracts.bicoStaking.configureAssets(
      [
        ethers.BigNumber.from(deployConfig.bicoStaking[0].emissionPerSecond), 
        ethers.BigNumber.from(deployConfig.bicoStaking[0].totalSupply),
        contracts.bicoStaking.address
      ]
    )).wait();

    //assetConfigure in BbptStaking
    await wait(5000);
    await (await contracts.bbptStaking.configureAssets(
      [
        ethers.BigNumber.from(deployConfig.bicoStaking[1].emissionPerSecond), 
        ethers.BigNumber.from(deployConfig.bicoStaking[1].totalSupply),
        contracts.bicoStaking.address
      ]
    )).wait();
    
}

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

const verifyImplementation = async (address: string, deployConfig?: IDeployConfig, stakingTokenConfig?: IStakingConfig) => {
    try {
      if(deployConfig && stakingTokenConfig){
        await run("verify:verify", {
          address: await getImplementationAddress(address),
          constructorArguments: [
            stakingTokenConfig.stakedToken,
            deployConfig.rewardToken,
            deployConfig.cooldownSeconds,
            deployConfig.unstakeWindow,
            deployConfig.rewardsVault,
            deployConfig.emissionManager,
            deployConfig.distributionDuration,
            stakingTokenConfig.name,
            stakingTokenConfig.symbol,
            deployConfig.decimals,
            deployConfig.governance
          ]
        });
      } else {
        await run("verify:verify", {
          address: await getImplementationAddress(address),
        });
      }
    } catch (e) {
      console.log(`Failed to verify Contract ${address} `, e);
    }
};

const verify = async (
    contracts: IContracts,
    deployConfig: IDeployConfig
  ) => {
    console.log("Verifying Contracts...");
    
    await verifyImplementation(contracts.bicoRewardVault.address);
    await verifyImplementation(contracts.bicoStaking.address, deployConfig, deployConfig.bicoStaking[0]);
    await verifyImplementation(contracts.bbptStaking.address, deployConfig, deployConfig.bicoStaking[1]);
    
}

export {
    IDeployConfig, deploy
};