const abi = require("ethereumjs-abi");
const chai = require('chai');
const { expect, expectRevert } = require("chai");
const chaiAsPromised = require('chai-as-promised');
const chaiBN = require('chai-bn');
const { ethers } = require("hardhat");
const {BN} = require('bn.js');
const { defaultAbiCoder } = ethers.utils;
// const logDecoder = require('../helper/log-decoder.js');

chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

const should = chai.should();

describe("AaveIncentivesController configureAssets", function () {
    let emissionManager;
    // let anyXAddress;
    let accounts;
    let contractToInteract;
    let biconomyDistributionManager;

    before(async function () {
        accounts = await ethers.getSigners(); 
        emissionManager = await accounts[0].getAddress(); 
        anyXAddress = await accounts[1].getAddress();

        const DistributionManager = await ethers.getContractFactory("AaveDistributionManager");
        biconomyDistributionManager = await DistributionManager.deploy(emissionManager, "3153600000");
        await biconomyDistributionManager.deployed();

        console.log(biconomyDistributionManager.address);
        contractToInteract = await ethers.getContractAt(
          "contracts/AaveDistributionManager.sol:AaveDistributionManager",
          biconomyDistributionManager.address);
    });

    describe("Polygon Token Actions", function () {  
      it('Tries to submit config updates not from emission manager', async () => {
        await expect(
          contractToInteract.connect(accounts[2]).configureAssets([])
        ).to.be.revertedWith('ONLY_EMISSION_MANAGER');
      });
    });
});