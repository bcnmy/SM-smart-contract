const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBN = require('chai-bn');
const { ethers } = require("hardhat");
const {BN} = require('bn.js');
const {BigNumber} = require('bignumber.js');
const { expect } = require("chai");
const { getRewards } = require('./helper/base-math');
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

describe("StakedToken V2. Basics", function () {
    let emissionManager;
    let accounts;
    let bicoToInteract;
    let distributionDuration;
    let stakedTokenV2;
    let bicoToken;
    let bicoRewardPool;
    let rewardPoolToInteract;
    let STAKED_TOKEN_NAME, STAKED_TOKEN_SYMBOL, STAKED_TOKEN_DECIMALS, COOLDOWN_SECONDS, UNSTAKE_WINDOW ;
    let ZERO_ADDRESS;
    let assetConfig;
    let user1;
    let sender;
    let user2;
    let user3;
    let toAddress;

    before(async function () {
        STAKED_TOKEN_NAME = 'Staked Bico';
        STAKED_TOKEN_SYMBOL = 'stkBICO';
        STAKED_TOKEN_DECIMALS = 18;
        COOLDOWN_SECONDS = '3600'; // 1 hour in seconds
        UNSTAKE_WINDOW = '1800'; // 30 min in seconds
        distributionDuration = 3153600000;
        ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
        
        accounts = await ethers.getSigners(); 
        sender = await accounts[0];
        user1 = await accounts[1];
        user2 = await accounts[2];
        user3 = await accounts[3];
        emissionManager = await accounts[4]; 
        toAddress = await accounts[5];

        
        // Deploy Test Bico Tokens
        const BicoToken = await ethers.getContractFactory("Bico");
        bicoToken = await BicoToken.deploy(
            "BICO Token",
            "BICO"
        );
        await bicoToken.deployed();
        bicoToInteract = await ethers.getContractAt("contracts/mock/Bico.sol:Bico",bicoToken.address);

        // Deploy BicoReservePool
        const BicoReservePool = await ethers.getContractFactory("BicoProtocolEcosystemReserve");
        bicoRewardPool = await BicoReservePool.deploy();
        await bicoRewardPool.deployed();
        rewardPoolToInteract = await ethers.getContractAt("contracts/BicoProtocolEcosystemReserve.sol:BicoProtocolEcosystemReserve",bicoRewardPool.address);
        
        // Deploy Staking contract
        const StakedToken = await ethers.getContractFactory("StakedTokenV3");
        stakedTokenV2 = await StakedToken.deploy(
            bicoToken.address, 
            bicoToken.address, 
            COOLDOWN_SECONDS,
            UNSTAKE_WINDOW, 
            bicoRewardPool.address, 
            emissionManager.address,
            distributionDuration, 
            STAKED_TOKEN_NAME,
            STAKED_TOKEN_SYMBOL, 
            STAKED_TOKEN_DECIMALS,
            ZERO_ADDRESS
        );
        await stakedTokenV2.deployed();
        // contractToInteract = await ethers.getContractAt("contracts/StakedTokenV3.sol:StakedTokenV3",stakedTokenV2.address);
        
        //Configure asset to be staked
        let underlyingAsset = stakedTokenV2.address;
        const assetConfiguration = assetConfig
        ? {
            ...assetConfig,
            underlyingAsset,
        }
        : {
            emissionPerSecond: '100',
            totalStaked: await stakedTokenV2.totalSupply(),
            underlyingAsset,
        };
        await stakedTokenV2.connect(emissionManager).configureAssets([assetConfiguration]);

        // // mint Bico to user1 address
        await bicoToInteract.connect(sender)._mint(user1.address, ethers.utils.parseEther('1000'));
        await bicoToInteract.connect(sender)._mint(bicoRewardPool.address, ethers.utils.parseEther('100000'));
        await bicoToInteract.connect(sender)._mint(user2.address, ethers.utils.parseEther('500'));
        await bicoToInteract.connect(sender)._mint(user3.address, ethers.utils.parseEther('500'));

        //Set Funds admin
        await rewardPoolToInteract.connect(sender).initialize(emissionManager.address )

        //Approve Reward pool to staking contract
        await rewardPoolToInteract.connect(emissionManager).approve(bicoToken.address, stakedTokenV2.address, ethers.utils.parseEther('100000') )
    });

    it('User 1 transfers 50 stkBICO to User 2', async () => {
        const amount = ethers.utils.parseEther('500');
        const amountToTransfer = ethers.utils.parseEther('50');
        await waitForTx(await bicoToInteract.connect(user1).approve(stakedTokenV2.address, amount));
        await waitForTx(await stakedTokenV2.connect(user1).stake(user1.address, amount));

        let stakerBalanceBefore = (await stakedTokenV2.balanceOf(user1.address)).toString();
        await stakedTokenV2.connect(user1).transfer(toAddress.address, amountToTransfer);

        let stakerBalanceAfter = (await stakedTokenV2.balanceOf(user1.address)).toString();
        let receiverBalanceAfter = (await stakedTokenV2.balanceOf(toAddress.address)).toString();
        
        expect(amountToTransfer.toString()).to.be.equal((stakerBalanceBefore - stakerBalanceAfter).toString());
        expect(receiverBalanceAfter.toString()).to.be.equal(amountToTransfer);
    });

    it('User 1 transfers 50 stkBICO to himself', async () => {
        const amount = ethers.utils.parseEther('50');

        let stakerBalanceBefore = (await stakedTokenV2.balanceOf(user1.address)).toString();
        await stakedTokenV2.connect(user1).transfer(user1.address, amount);
        let stakerBalanceAfter = (await stakedTokenV2.balanceOf(user1.address)).toString();

        expect(stakerBalanceAfter.toString()).to.be.equal(stakerBalanceBefore.toString());

    });

    it('User 1 transfers 50 stkBICO to user 3, with rewards not enabled', async () => {
        const amount = ethers.utils.parseEther('50');

        // Configuration to disable emission
        const assetConfig = {
            emissionPerSecond: '0',
            totalStaked: '0',
        };
        const assetConfiguration = {
            ...assetConfig,
            underlyingAsset: stakedTokenV2.address,
        }
        await stakedTokenV2.connect(emissionManager).configureAssets([assetConfiguration]);

        const userBalance = new BigNumber(
            (await stakedTokenV2.balanceOf(user3.address)).toString()
        );

        const rewardsBalanceBefore = await stakedTokenV2.getTotalRewardsBalance(user3.address)

        // Get index before actions
        const userIndexBefore = new BigNumber(
            await (await stakedTokenV2.getUserAssetData(user3.address, stakedTokenV2.address)).toString()
        );

        await stakedTokenV2.connect(user1).transfer(user3.address, amount);

        const userIndexAfter = new BigNumber(
            await (await stakedTokenV2.getUserAssetData(user3.address, stakedTokenV2.address)).toString()
        );

        // Compare calculated JS rewards versus Solidity user rewards
        const rewardsBalanceAfter = await stakedTokenV2.getTotalRewardsBalance(user3.address);
        const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore.add(expectedAccruedRewards));

        // Explicit check rewards when the test case expects rewards to the user
        expect(expectedAccruedRewards).to.be.eq(0);
        expect(rewardsBalanceAfter).to.be.eq(rewardsBalanceBefore);

        // Expect rewards balance to still be zero
        const rewardsBalance = await (
            await stakedTokenV2.getTotalRewardsBalance(user3.address)
        ).toString();
        expect(rewardsBalance).to.be.equal('0');
    });


    it('Activate cooldown of User1, transfer entire amount from User1 to User2, cooldown of User1 should be reset', async () => {
        await stakedTokenV2.connect(user1).cooldown();
        const cooldownActivationTimestamp = await (await timeLatest()).toString();

        const cooldownTimestamp = await stakedTokenV2.stakersCooldowns(user1.address);
        expect(cooldownTimestamp.gt('0')).to.be.ok;
        expect(cooldownTimestamp.toString()).to.equal(cooldownActivationTimestamp);

        const userBalance = new BigNumber(
            (await stakedTokenV2.balanceOf(user1.address)).toString()
        );

        await stakedTokenV2.connect(user1).transfer(user2.address, userBalance.toString());

        // Expect cooldown time to reset after sending the entire balance of sender
        const cooldownTimestampAfterTransfer = await (
            await stakedTokenV2.stakersCooldowns(user1.address)
        ).toString();
        expect(cooldownTimestampAfterTransfer).to.equal('0');
    });

    it('Transfer balance from User 2 to user 1, cooldown  of User 1 should be reset if User2 cooldown expired', async () => {
        const amount = ethers.utils.parseEther('10');

        // Configuration to disable emission
        const assetConfig = {
            emissionPerSecond: '0',
            totalStaked: '0',
        };
        const assetConfiguration = {
            ...assetConfig,
            underlyingAsset: stakedTokenV2.address,
        }
        await stakedTokenV2.connect(emissionManager).configureAssets([assetConfiguration]);

        await bicoToken.connect(user1).approve(stakedTokenV2.address, amount);
        await stakedTokenV2.connect(user1).stake(user1.address, amount);

        // First enable cooldown for sender
        await stakedTokenV2.connect(user1).cooldown();

        // Then enable cooldown for receiver
        await bicoToken.connect(user2).approve(stakedTokenV2.address, amount);
        await stakedTokenV2.connect(user2).stake(user2.address, amount);
        await stakedTokenV2.connect(user2).cooldown();

        const receiverCooldown = await stakedTokenV2.stakersCooldowns(user1.address);

        // Increase time to an invalid time for cooldown
        await increaseTimeAndMine(
            receiverCooldown.add(COOLDOWN_SECONDS).add(UNSTAKE_WINDOW).add(1).toNumber()
        );
        // Transfer staked token from sender to receiver, it will also transfer the cooldown status from sender to the receiver
        const stakerBalance = new BigNumber(
            (await stakedTokenV2.balanceOf(user1.address)).toString()
        );

        await stakedTokenV2.connect(user1).transfer(user2.address, stakerBalance.toString());

        // Receiver cooldown should be set to zero
        const stakerCooldownTimestampBefore = await stakedTokenV2.stakersCooldowns(user2.address);
        expect(stakerCooldownTimestampBefore.eq(0)).to.be.ok;
    });

    it('Transfer balance from User 3 to user 2, cooldown of User 2 should be the same if User3 cooldown is less than User2 cooldown', async () => {
        const amount = ethers.utils.parseEther('10');

        // Configuration to disable emission
        const assetConfig = {
            emissionPerSecond: '0',
            totalStaked: '0',
        };

        const assetConfiguration = {
            ...assetConfig,
            underlyingAsset: stakedTokenV2.address,
        }
        await stakedTokenV2.connect(emissionManager).configureAssets([assetConfiguration]);

        await bicoToken.connect(user1).approve(stakedTokenV2.address, amount);
        await stakedTokenV2.connect(user1).stake(user1.address, amount);

        // Enable cooldown for sender
        await stakedTokenV2.connect(user1).cooldown();
        await increaseTime(5);

        // Enable enable cooldown for receiver
        await stakedTokenV2.connect(user2).cooldown();
        const receiverCooldown = await (
            await stakedTokenV2.stakersCooldowns(user2.address)
        ).toString();

        // Transfer staked token from sender to receiver, it will also transfer the cooldown status from sender to the receiver
        const stakerBalance = new BigNumber(
            (await stakedTokenV2.balanceOf(user1.address)).toString()
        );

        await stakedTokenV2.connect(user1).transfer(user2.address, stakerBalance.toString());

        // Receiver cooldown should be like before
        const receiverCooldownAfterTransfer = await (
            await stakedTokenV2.stakersCooldowns(user2.address)
        ).toString();
        expect(receiverCooldownAfterTransfer).to.be.equal(receiverCooldown);
    });

    waitForTx = (tx) => {
        return tx.wait();   
    }
    increaseTimeAndMine = async (secondsToIncrease) => {
        await ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
        await ethers.provider.send('evm_mine', []);
    };

    advanceBlock = async (timestamp) => {
        const priorBlock = await ethers.provider.getBlockNumber();
        await ethers.provider.send('evm_mine', timestamp ? [timestamp] : []);
        const nextBlock = await ethers.provider.getBlockNumber();
        if (!timestamp && nextBlock == priorBlock) {
          await advanceBlock();
          return;
        }
    };

    timeLatest = async () => {
        const block = await ethers.provider.getBlock('latest');
        return new BigNumber(block.timestamp);
    };

    increaseTime = async (secondsToIncrease) =>
        await ethers.provider.send('evm_increaseTime', [secondsToIncrease]);
});