import { deploy, IDeployConfig } from "./helpers";

(async () => {
    const config: IDeployConfig = {
        rewardToken: "0xEf2E078a649aAd3908b7F4f9aD75A881D4f3b7e3",
        cooldownSeconds: 600,
        unstakeWindow: 172800,
        rewardsVault: "0x7E3EC659C65b48FC74e528f81774D31E5A1dA8F9",
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
                emissionPerSecond: "6365740740740741",
                totalSupply: "1000000000000000000000000"
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