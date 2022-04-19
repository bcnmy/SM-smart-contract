import { deploy, IDeployConfig } from "./helpers";

(async () => {
    const config: IDeployConfig = {
        rewardToken: "0xEf2E078a649aAd3908b7F4f9aD75A881D4f3b7e3",
        cooldownSeconds: 1200,
        unstakeWindow: 600,
        rewardsVault: "0x972519dc473dd9208fbfd4aa2c5edcbbab3c9f65",
        emissionManager: "0x5bA58370D689076f2370A6617A3399dB6A63Bb7e",
        distributionDuration: 21600,
        decimals: 18,
        governance: "0x0000000000000000000000000000000000000000",
        trustedForwarder: "0xF82986F574803dfFd9609BE8b9c7B92f63a1410E",
        bicoStaking : [
            // Bico Staking
            {
                stakedToken: "0xEf2E078a649aAd3908b7F4f9aD75A881D4f3b7e3",
                name: "Staked Bico Token",
                symbol: "stkBICO", 
                emissionPerSecond: "100000000000000000",
                totalSupply: "0"
            },
            // BBPT Staking
            {
                stakedToken: "0x88d15686E2b4cFfaCD54A73434bDd7B0266A9142",
                name: "Staked BBPT Token",
                symbol: "stkBBPT", 
                emissionPerSecond: "1000000000000000",
                totalSupply: "1000000000000000000000000" 
            }
        ],
        
        
    }

    await deploy(config);
})();