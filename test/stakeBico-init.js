const chai = require('chai');
const { expect } = require("chai");
const chaiAsPromised = require('chai-as-promised');
const chaiBN = require('chai-bn');
const { ethers } = require("hardhat");
const {BN} = require('bn.js');
const {BigNumber} = require('bignumber.js');
const { getRewards } = require('./helper/base-math');
const MAX_UINT_AMOUNT =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';
chai
  .use(chaiAsPromised)
  .use(chaiBN(BN))
  .should()

describe("StakedAave V2. Basics", function () {
    let emissionManager;
    let sender;
    let accounts;
    let contractToInteract, bicoToInteract;
    let distributionDuration;
    let stakedTokenV2;
    let bicoToken;
    let bicoRewardPool;
    let rewardPoolToInteract;
    let STAKED_AAVE_NAME, STAKED_AAVE_SYMBOL, STAKED_AAVE_DECIMALS, COOLDOWN_SECONDS, UNSTAKE_WINDOW ;
    let rewardsVault;
    let ZERO_ADDRESS;
    let assetConfig;
    let secondStaker;

    before(async function () {
        STAKED_AAVE_NAME = 'Staked Aave';
        STAKED_AAVE_SYMBOL = 'stkAAVE';
        STAKED_AAVE_DECIMALS = 18;
        COOLDOWN_SECONDS = '3600'; // 1 hour in seconds
        UNSTAKE_WINDOW = '1800'; // 30 min in seconds
        distributionDuration = 3153600000;
        ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
        
        accounts = await ethers.getSigners(); 
        emissionManager = await accounts[0]; 
        
        rewardsVault = await accounts[1].getAddress();
        sender = await accounts[2];
        staker = await accounts[3];
        secondStaker = accounts[4];
        thirdStaker = accounts[5];

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
            STAKED_AAVE_NAME,
            STAKED_AAVE_SYMBOL, 
            STAKED_AAVE_DECIMALS, 
            ZERO_ADDRESS
        );
        await stakedTokenV2.deployed();
        contractToInteract = await ethers.getContractAt("contracts/StakedTokenV3.sol:StakedTokenV3",stakedTokenV2.address);
        
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
        await contractToInteract.configureAssets([assetConfiguration]);

        // mint Bico to staker address
        await bicoToInteract.connect(sender)._mint(staker.address, ethers.utils.parseEther('1000'));
        await bicoToInteract.connect(sender)._mint(bicoRewardPool.address, ethers.utils.parseEther('100000'));
        await bicoToInteract.connect(sender)._mint(secondStaker.address, ethers.utils.parseEther('5000'));
        await bicoToInteract.connect(sender)._mint(thirdStaker.address, ethers.utils.parseEther('5000'));

        //Set Funds admin
        await rewardPoolToInteract.connect(sender).initialize(emissionManager.address )

        //Approve Reward pool to staking contract
        await rewardPoolToInteract.connect(emissionManager).approve(bicoToken.address, stakedTokenV2.address, ethers.utils.parseEther('100000') )
    });

    it('Initial configuration after initialize() is correct', async () => {
    
        expect(await contractToInteract.name()).to.be.equal(STAKED_AAVE_NAME);
        expect(await contractToInteract.symbol()).to.be.equal(STAKED_AAVE_SYMBOL);
        expect(await contractToInteract.decimals()).to.be.equal(STAKED_AAVE_DECIMALS);
        expect(await contractToInteract.REVISION()).to.be.equal(1);
        expect(await contractToInteract.STAKED_TOKEN()).to.be.equal(bicoToken.address);
        expect(await contractToInteract.REWARD_TOKEN()).to.be.equal(bicoToken.address);
        expect((await contractToInteract.COOLDOWN_SECONDS()).toString()).to.be.equal(COOLDOWN_SECONDS);
        expect((await contractToInteract.UNSTAKE_WINDOW()).toString()).to.be.equal(UNSTAKE_WINDOW);
        expect(await contractToInteract.REWARDS_VAULT()).to.be.equal(bicoRewardPool.address);
    });

    it('Reverts trying to stake 0 amount', async () => {
        const amount = '0';
    
        await expect(
            contractToInteract.connect(sender).stake(sender.getAddress(), amount)
        ).to.be.revertedWith('INVALID_ZERO_AMOUNT');
    });

    it('Reverts trying to activate cooldown with 0 staked amount', async () => {
    
        await expect(contractToInteract.connect(sender).cooldown()).to.be.revertedWith(
          'INVALID_BALANCE_ON_COOLDOWN'
        );
    });

    it('User 1 stakes 50 AAVE: receives 50 SAAVE, StakedAave balance of AAVE is 50 and his rewards to claim are 0', async () => {
        const amount = ethers.utils.parseEther('50');
        const rewardsBalanceBefore = await contractToInteract.getTotalRewardsBalance(staker.address);

        const userIndexBefore = new BigNumber(
            await (await contractToInteract.getUserAssetData(staker.address, stakedTokenV2.address)).toString()
        );

        const saveBalanceBefore = new BigNumber(
          (await contractToInteract.balanceOf(staker.address)).toString()
        );

        // Prepare actions for the test case
        await bicoToInteract.connect(staker).approve(stakedTokenV2.address, amount);
        await contractToInteract.connect(staker).stake(staker.address, amount);
        
        const saveBalanceAfter = new BigNumber(
            (await contractToInteract.balanceOf(staker.address)).toString()
        );
       
        // Check rewards 
        const rewardsBalanceAfter = await contractToInteract.getTotalRewardsBalance(staker.address);

        const userIndexAfter = new BigNumber(
            await (await contractToInteract.getUserAssetData(staker.address, stakedTokenV2.address)).toString()
        );

        const expectedAccruedRewards = getRewards(saveBalanceBefore, userIndexAfter, userIndexBefore);

        // Stake token tests
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore.add(expectedAccruedRewards));
        expect((await contractToInteract.balanceOf(staker.address)).toString()).to.be.equal(
          saveBalanceBefore.plus(amount.toString()).toString()
        );
        expect((await bicoToInteract.balanceOf(contractToInteract.address)).toString()).to.be.equal(
          saveBalanceBefore.plus(amount.toString()).toString()
        );
        expect((await contractToInteract.balanceOf(staker.address)).toString()).to.be.equal(amount);
        expect((await bicoToInteract.balanceOf(contractToInteract.address)).toString()).to.be.equal(amount);
    });

    it('User 1 stakes 20 AAVE more: his total SAAVE balance increases, StakedAave balance of Aave increases and his reward until now get accumulated', async () => {
        const amount = ethers.utils.parseEther('20');
        const userIndexBefore = new BigNumber(
            await (await contractToInteract.getUserAssetData(staker.address, stakedTokenV2.address)).toString()
        );
        const saveBalanceBefore = new BigNumber(
            (await contractToInteract.balanceOf(staker.address)).toString()
        );
        
        await bicoToInteract.connect(staker).approve(stakedTokenV2.address, amount);
        await contractToInteract.connect(staker).stake(staker.address, amount);
        const userIndexAfter = new BigNumber(
            await (await contractToInteract.getUserAssetData(staker.address, stakedTokenV2.address)).toString()
        );

        // Checks rewards
        const expectedAccruedRewards = getRewards(saveBalanceBefore, userIndexAfter, userIndexBefore);

        // Extra test checks
        expect((await contractToInteract.balanceOf(staker.address)).toString()).to.be.equal(
            saveBalanceBefore.plus(amount.toString()).toString()
        );
        expect((await bicoToInteract.balanceOf(stakedTokenV2.address)).toString()).to.be.equal(
            saveBalanceBefore.plus(amount.toString()).toString()
        );
    });

    it('User 1 claim half rewards ', async () => {
        await ethers.provider.send('evm_increaseTime', [1000]);
        await ethers.provider.send('evm_mine', []);   

        const halfRewards = (await contractToInteract.stakerRewardsToClaim(staker.address)).div(2);
        const saveUserBalance = await bicoToInteract.balanceOf(staker.address);

        await contractToInteract.connect(staker).claimRewards(staker.address, halfRewards);

        const userBalanceAfterActions = await bicoToInteract.balanceOf(staker.address);
        expect(userBalanceAfterActions.eq(saveUserBalance.add(halfRewards))).to.be.ok;
    });

    it('User 1 tries to claim higher reward than current rewards balance', async () => {
        const saveUserBalance = await bicoToInteract.balanceOf(staker.address);

        // Try to claim more amount than accumulated
        await expect(
            contractToInteract
            .connect(staker)
            .claimRewards(staker.address, ethers.utils.parseEther('10000'))
        ).to.be.revertedWith('INVALID_AMOUNT');

        const userBalanceAfterActions = await bicoToInteract.balanceOf(staker.address);
        expect(userBalanceAfterActions.eq(saveUserBalance)).to.be.ok;
    });

    it('User 1 claim all rewards', async () => {
        const userAddress = staker.address;

        const userBalance = await contractToInteract.balanceOf(userAddress);
        const userAaveBalance = await bicoToInteract.balanceOf(userAddress);
        const userRewards = await contractToInteract.stakerRewardsToClaim(userAddress);

        // Get index before actions
        const userIndexBefore = new BigNumber(
            await (await contractToInteract.getUserAssetData(staker.address, stakedTokenV2.address)).toString()
        );

        // Claim rewards
        await expect(contractToInteract.connect(staker).claimRewards(staker.address, MAX_UINT_AMOUNT));

        // Get index after actions
        const userIndexAfter = new BigNumber(
            await (await contractToInteract.getUserAssetData(staker.address, stakedTokenV2.address)).toString()
        );

        const expectedAccruedRewards = getRewards(
            userBalance,
            userIndexAfter,
            userIndexBefore
        ).toString();
        const userAaveBalanceAfterAction = (await bicoToInteract.balanceOf(userAddress)).toString();

        expect(userAaveBalanceAfterAction).to.be.equal(
            userAaveBalance.add(userRewards).add(expectedAccruedRewards).toString()
        );
    });

    it('User 2 stakes 50 AAVE, with the rewards not enabled', async () => {
        const amount = ethers.utils.parseEther('50');

        const userBalance = new BigNumber(
            (await contractToInteract.balanceOf(secondStaker.address)).toString()
        );

        // Checks rewards
        const rewardsBalanceBefore = await contractToInteract.getTotalRewardsBalance(secondStaker.address)
       
        // Get index before actions
        const userIndexBefore = new BigNumber(
            await (await contractToInteract.getUserAssetData(secondStaker.address, stakedTokenV2.address)).toString()
        );
        
        await bicoToInteract.connect(secondStaker).approve(stakedTokenV2.address, amount);
        await contractToInteract.connect(secondStaker).stake(secondStaker.address, amount);
        
        const userIndexAfter = new BigNumber(
            await (await contractToInteract.getUserAssetData(secondStaker.address, stakedTokenV2.address)).toString()
        );

        // Compare calculated JS rewards versus Solidity user rewards
        const rewardsBalanceAfter = await contractToInteract.getTotalRewardsBalance(secondStaker.address);
        const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore.add(expectedAccruedRewards));

        // Explicit check rewards when the test case expects rewards to the user
        expect(expectedAccruedRewards).to.be.eq(0);
        expect(rewardsBalanceAfter).to.be.eq(rewardsBalanceBefore);
        
        // Check expected stake balance for second staker
        expect((await contractToInteract.balanceOf(secondStaker.address)).toString()).to.be.equal(
            amount.toString()
        );

        // Expect rewards balance to still be zero
        const rewardsBalance = await (
            await contractToInteract.getTotalRewardsBalance(secondStaker.address)
        ).toString();
        expect(rewardsBalance).to.be.equal('0');
    });

    it('User 2 stakes 30 AAVE more, with the rewards not enabled', async () => {
        const amount = ethers.utils.parseEther('30');

        // Keep rewards disabled via config
        const assetsConfig = {
            emissionPerSecond: '0',
            totalStaked: '0',
        };

        const assetConfiguration = {
            ...assetsConfig,
            underlyingAsset: stakedTokenV2.address,
        }
        
        await contractToInteract.configureAssets([assetConfiguration]);

        const userBalance = new BigNumber(
            (await contractToInteract.balanceOf(secondStaker.address)).toString()
        );

        // Checks rewards
        const rewardsBalanceBefore = await contractToInteract.getTotalRewardsBalance(secondStaker.address)
       
        // Get index before actions
        const userIndexBefore = new BigNumber(
            await (await contractToInteract.getUserAssetData(secondStaker.address, stakedTokenV2.address)).toString()
        );
        
        await bicoToInteract.connect(secondStaker).approve(stakedTokenV2.address, amount);
        await contractToInteract.connect(secondStaker).stake(secondStaker.address, amount);
        
        // await compareRewardsAtAction(stakedAaveV2, sixStaker.address, actions, false, assetsConfig);

        const userIndexAfter = new BigNumber(
            await (await contractToInteract.getUserAssetData(secondStaker.address, stakedTokenV2.address)).toString()
        );

        // Compare calculated JS rewards versus Solidity user rewards
        const rewardsBalanceAfter = await contractToInteract.getTotalRewardsBalance(secondStaker.address);
        const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore.add(expectedAccruedRewards));

        // Explicit check rewards when the test case expects rewards to the user
        expect(expectedAccruedRewards).to.be.eq(0);
        expect(rewardsBalanceAfter).to.be.eq(rewardsBalanceBefore);

        // Expect rewards balance to still be zero
        const rewardsBalance = await (
            await contractToInteract.getTotalRewardsBalance(secondStaker.address)
        ).toString();
        expect(rewardsBalance).to.be.equal('0');
    });

    it('Validates staker cooldown with stake() while being on valid unstake window', async () => {
        const amount1 = ethers.utils.parseEther('50');
        const amount2 = ethers.utils.parseEther('20');
        const amount = ethers.utils.parseEther('50').add(ethers.utils.parseEther('20'));

        const userBalance = new BigNumber(
            (await contractToInteract.balanceOf(thirdStaker.address)).toString()
        );

        // Checks rewards
        const rewardsBalanceBefore = await contractToInteract.getTotalRewardsBalance(thirdStaker.address)
       
        // Get index before actions
        const userIndexBefore = new BigNumber(
            await (await contractToInteract.getUserAssetData(thirdStaker.address, stakedTokenV2.address)).toString()
        );
        
        await bicoToInteract.connect(thirdStaker).approve(stakedTokenV2.address, amount);
        await contractToInteract.connect(thirdStaker).stake(thirdStaker.address, amount1);
        
        const userIndexAfter = new BigNumber(
            await (await contractToInteract.getUserAssetData(thirdStaker.address, stakedTokenV2.address)).toString()
        );

        // Compare calculated JS rewards versus Solidity user rewards
        const rewardsBalanceAfter = await contractToInteract.getTotalRewardsBalance(thirdStaker.address);
        const expectedAccruedRewards = getRewards(userBalance, userIndexAfter, userIndexBefore);
        expect(rewardsBalanceAfter).to.eq(rewardsBalanceBefore.add(expectedAccruedRewards));

        // Explicit check rewards when the test case expects rewards to the user
        expect(expectedAccruedRewards).to.be.eq(0);
        expect(rewardsBalanceAfter).to.be.eq(rewardsBalanceBefore);

        await contractToInteract.connect(thirdStaker).cooldown();

        const cooldownActivationTimestamp = new BigNumber((await ethers.provider.getBlock('latest')).timestamp);
        await advanceBlock(
            cooldownActivationTimestamp.plus(new BigNumber(COOLDOWN_SECONDS).plus(1000)).toNumber()
        ); // We fast-forward time to just after the unstake window

        const stakerCooldownTimestampBefore = new BigNumber(
            (await contractToInteract.stakersCooldowns(thirdStaker.address)).toString()
        );
        let tx = await contractToInteract.connect(thirdStaker).stake(thirdStaker.address, amount2);
        await tx.wait();

        const latestTimestamp = (await ethers.provider.getBlock('latest')).timestamp;

        const expectedCooldownTimestamp = amount2
            .mul(latestTimestamp.toString())
            .add(amount1.mul(stakerCooldownTimestampBefore.toString()))
            .div(amount2.add(amount1));

        expect(expectedCooldownTimestamp.toString()).to.be.equal(
            (await contractToInteract.stakersCooldowns(thirdStaker.address)).toString()
        );
    });

    advanceBlock = async (timestamp) => {
        const priorBlock = await ethers.provider.getBlockNumber();
        await ethers.provider.send('evm_mine', timestamp ? [timestamp] : []);
        const nextBlock = await ethers.provider.getBlockNumber();
        if (!timestamp && nextBlock == priorBlock) {
          await advanceBlock();
          return;
        }
    };
    
});