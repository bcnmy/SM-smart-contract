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
    let distributionDuration;
    let stakedTokenV2;
    let bicoToken;
    let bicoRewardPool;
    let rewardPoolToInteract;
    let STAKED_AAVE_NAME, STAKED_AAVE_SYMBOL, STAKED_AAVE_DECIMALS, COOLDOWN_SECONDS, UNSTAKE_WINDOW ;
    let ZERO_ADDRESS;
    let assetConfig;
    let secondStaker;

    before(async function () {
        STAKED_AAVE_NAME = 'Staked Bico';
        STAKED_AAVE_SYMBOL = 'stkBICO';
        STAKED_AAVE_DECIMALS = 18;
        COOLDOWN_SECONDS = '3600'; // 1 hour in seconds
        UNSTAKE_WINDOW = '1800'; // 30 min in seconds
        distributionDuration = 3153600000;
        ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
        
        accounts = await ethers.getSigners(); 
        emissionManager = await accounts[0]; 
        
        sender = await accounts[2];
        staker = await accounts[3];
        secondStaker = await accounts[4];
        thirdStaker = await accounts[5];

        // Deploy Test Bico Tokens
        const BicoToken = await ethers.getContractFactory("Bico");
        bicoToken = await BicoToken.deploy(
            "BICO Token",
            "BICO"
        );
        await bicoToken.deployed();

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
        await stakedTokenV2.configureAssets([assetConfiguration]);

        // mint Bico to staker address
        await bicoToken.connect(sender)._mint(staker.address, ethers.utils.parseEther('1000'));
        await bicoToken.connect(sender)._mint(bicoRewardPool.address, ethers.utils.parseEther('100000'));
        await bicoToken.connect(sender)._mint(secondStaker.address, ethers.utils.parseEther('500'));
        await bicoToken.connect(sender)._mint(thirdStaker.address, ethers.utils.parseEther('500'));

        //Set Funds admin
        await rewardPoolToInteract.connect(sender).initialize(emissionManager.address )

        //Approve Reward pool to staking contract
        await rewardPoolToInteract.connect(emissionManager).approve(bicoToken.address, stakedTokenV2.address, ethers.utils.parseEther('100000') )
    });

    it('Reverts trying to redeem 0 amount', async () => {
        const amount = '0';

        await expect(
            stakedTokenV2.connect(staker).redeem(staker.address, amount)
        ).to.be.revertedWith('INVALID_ZERO_AMOUNT');
    });

    it('User 1 stakes 50 BICO', async () => {
        const amount = ethers.utils.parseEther('50');

        await waitForTx(await bicoToken.connect(staker).approve(stakedTokenV2.address, amount));
        await waitForTx(await stakedTokenV2.connect(staker).stake(staker.address, amount));
    });

    it('User 1 tries to redeem without activating the cooldown first', async () => {
        const amount = ethers.utils.parseEther('50');

        await expect(
            stakedTokenV2.connect(staker).redeem(staker.address, amount)
        ).to.be.revertedWith('UNSTAKE_WINDOW_FINISHED');
    });

    it('User 1 activates the cooldown, but is not able to redeem before the COOLDOWN_SECONDS passed', async () => {
        const amount = ethers.utils.parseEther('50');

        await stakedTokenV2.connect(staker).cooldown();

        const startedCooldownAt = new BigNumber(
            await (await stakedTokenV2.stakersCooldowns(staker.address)).toString()
        );
        const currentTime = await timeLatest();

        const remainingCooldown = startedCooldownAt.plus(COOLDOWN_SECONDS).minus(currentTime);
        await increaseTimeAndMine(Number(remainingCooldown.dividedBy('2').toString()));
        await expect(
            stakedTokenV2.connect(staker).redeem(staker.address, amount)
        ).to.be.revertedWith('INSUFFICIENT_COOLDOWN');

        await advanceBlock(startedCooldownAt.plus(new BigNumber(COOLDOWN_SECONDS).minus(1)).toNumber()); // We fast-forward time to just before COOLDOWN_SECONDS

        await expect(
            stakedTokenV2.connect(staker).redeem(staker.address, amount)
        ).to.be.revertedWith('INSUFFICIENT_COOLDOWN');

        await advanceBlock(
            startedCooldownAt
            .plus(new BigNumber(COOLDOWN_SECONDS).plus(UNSTAKE_WINDOW).plus(1))
            .toNumber()
        ); // We fast-forward time to just after the unstake window

        await expect(
            stakedTokenV2.connect(staker).redeem(staker.address, amount)
        ).to.be.revertedWith('UNSTAKE_WINDOW_FINISHED');
    });

    it('User 1 activates the cooldown again, and tries to redeem a bigger amount that he has staked, receiving the balance', async () => {
        const amount = ethers.utils.parseEther('1000');

        await stakedTokenV2.connect(staker).cooldown();
        const startedCooldownAt = new BigNumber(
            await (await stakedTokenV2.stakersCooldowns(staker.address)).toString()
        );
        const currentTime = await timeLatest();

        const remainingCooldown = startedCooldownAt.plus(COOLDOWN_SECONDS).minus(currentTime);

        await increaseTimeAndMine(remainingCooldown.plus(1).toNumber());
        const bicoBalanceBefore = new BigNumber((await bicoToken.balanceOf(staker.address)).toString());
        const stakedBicoBalanceBefore = (await stakedTokenV2.balanceOf(staker.address)).toString();
        await stakedTokenV2.connect(staker).redeem(staker.address, amount);
        const bicoBalanceAfter = new BigNumber((await bicoToken.balanceOf(staker.address)).toString());
        const stakedBicoBalanceAfter = (await stakedTokenV2.balanceOf(staker.address)).toString();
        expect(bicoBalanceAfter.minus(stakedBicoBalanceBefore).toString()).to.be.equal(
            bicoBalanceBefore.toString()
        );
        expect(stakedBicoBalanceAfter).to.be.equal('0');
    });

    it('User 1 activates the cooldown again, and redeems within the unstake period', async () => {
        const amount = ethers.utils.parseEther('50');

        await waitForTx(await bicoToken.connect(staker).approve(stakedTokenV2.address, amount));
        await waitForTx(await stakedTokenV2.connect(staker).stake(staker.address, amount));

        await stakedTokenV2.connect(staker).cooldown();
        const startedCooldownAt = new BigNumber(
            await (await stakedTokenV2.stakersCooldowns(staker.address)).toString()
        );
        const currentTime = await timeLatest();

        const remainingCooldown = startedCooldownAt.plus(COOLDOWN_SECONDS).minus(currentTime);

        await increaseTimeAndMine(remainingCooldown.plus(1).toNumber());
        const bicoBalanceBefore = new BigNumber((await bicoToken.balanceOf(staker.address)).toString());
        await stakedTokenV2.connect(staker).redeem(staker.address, amount);
        const bicoBalanceAfter = new BigNumber((await bicoToken.balanceOf(staker.address)).toString());
        expect(bicoBalanceAfter.minus(amount.toString()).toString()).to.be.equal(
            bicoBalanceBefore.toString()
        );
    });

    it('User 2 stakes 50 BICO, activates the cooldown and redeems half of the amount', async () => {
        const amount = ethers.utils.parseEther('50');

        await waitForTx(await bicoToken.connect(secondStaker).approve(stakedTokenV2.address, amount));
        await waitForTx(await stakedTokenV2.connect(secondStaker).stake(secondStaker.address, amount));

        await stakedTokenV2.connect(secondStaker).cooldown();

        const cooldownActivationTimestamp = await timeLatest();
        const bicoBalanceBefore = new BigNumber((await bicoToken.balanceOf(secondStaker.address)).toString());

        await advanceBlock(
            cooldownActivationTimestamp.plus(new BigNumber(COOLDOWN_SECONDS).plus(1)).toNumber()
        );

        await stakedTokenV2
            .connect(secondStaker)
            .redeem(secondStaker.address, ethers.utils.parseEther('50').div(2));
        const bicoBalanceAfter = new BigNumber((await bicoToken.balanceOf(secondStaker.address)).toString());
        expect(bicoBalanceAfter.minus(amount.div(2).toString()).toString()).to.be.equal(
            bicoBalanceBefore.toFixed()
        );
    });

    it('User 3 stakes 50 BICO, activates the cooldown and redeems with rewards not enabled', async () => {
        const amount = ethers.utils.parseEther('50');

        await waitForTx(await bicoToken.connect(thirdStaker).approve(stakedTokenV2.address, amount));
        await waitForTx(await stakedTokenV2.connect(thirdStaker).stake(thirdStaker.address, amount));

        await stakedTokenV2.connect(thirdStaker).cooldown();

        const cooldownActivationTimestamp = await timeLatest();

        await advanceBlock(
            cooldownActivationTimestamp.plus(new BigNumber(COOLDOWN_SECONDS).plus(1)).toNumber()
        );

        const bicoBalanceBefore = new BigNumber((await bicoToken.balanceOf(thirdStaker.address)).toString());
        await stakedTokenV2.connect(thirdStaker).redeem(thirdStaker.address, amount);
        const bicoBalanceAfter = new BigNumber((await bicoToken.balanceOf(thirdStaker.address)).toString());
        expect(bicoBalanceAfter.minus(amount.toString()).toString()).to.be.equal(
            bicoBalanceBefore.toString()
        );
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
});