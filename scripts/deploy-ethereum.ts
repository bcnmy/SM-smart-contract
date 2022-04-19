import { deploy, IDeployConfig } from "./helpers";

(async () => {
    const config: IDeployConfig = {
        rewardToken: "0xF17e65822b568B3903685a7c9F496CF7656Cc6C2",
        cooldownSeconds: 1814400, //21 days
        unstakeWindow: 259200, // 3 days
        rewardsVault: "0xa6737d7fdf4dd5307ab632d401df7f8a42ea2588",
        emissionManager: "0x12eEa3f557E8537b05A5d2EC5eBb3c7D2f7f1a08",
        distributionDuration: 3153600000, // 100 years 
        decimals: 18,
        governance: "0x0000000000000000000000000000000000000000",
        trustedForwarder: "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
        bicoStaking : [
            // Bico Staking
            {
                stakedToken: "0xF17e65822b568B3903685a7c9F496CF7656Cc6C2",
                name: "Staked Bico Token",
                symbol: "stkBICO", 
                emissionPerSecond: "100000000000000000",
                totalSupply: "0"
            },
            //BBPT Staking
            {
                stakedToken: "0x16F8383E99c22Fb33144ee9808B4Ab25b06C5bb5",
                name: "Staked Bico BPT Token",
                symbol: "stkBBPT", 
                emissionPerSecond: "1000000000000000",
                totalSupply: "0"  
            }
        ],
    }

    await deploy(config);
})();