const axios = require('axios');
const { ethers } = require('ethers');
const fs = require('fs').promises;

// Referral configuration
const INVITER_CODE = "5EJhL8Z0IlqmHpt";
const config = {
    baseUrl: 'https://back.aidapp.com',
    campaignId: '6b963d81-a8e9-4046-b14f-8454bc3e6eb2',
    excludedMissionId: 'f8edb0b4-ac7d-4a32-8522-65c5fb053725',
    headers: {
        'accept': '*/*',
        'origin': 'https://my.aidapp.com',
        'referer': 'https://my.aidapp.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
    }
};

// Function to create a new wallet
function createWallet() {
    const wallet = ethers.Wallet.createRandom();
    console.log(`New Wallet: ${wallet.address}`);
    return wallet;
}

// Function to save account details
async function saveAccount(wallet, refCode) {
    const data = `Address: ${wallet.address}\nPrivateKey: ${wallet.privateKey}\nRefCode: ${refCode}\n\n`;
    await fs.appendFile('accounts.txt', data);
    console.log(`Account saved to accounts.txt`);
}

// Function to save token
async function saveToken(token) {
    await fs.appendFile('token.txt', `${token.access_token}\n`);
    console.log(`Access token saved to token.txt`);
}

// Function to sign an authentication message
async function signMessage(wallet, message) {
    return await wallet.signMessage(message);
}

// Function to perform login
async function login(wallet) {
    const timestamp = Date.now();
    const message = `MESSAGE_ETHEREUM_${timestamp}:${timestamp}`;
    const signature = await signMessage(wallet, message);
    
    const url = `${config.baseUrl}/user-auth/login?strategy=WALLET&chainType=EVM&address=${wallet.address}&token=${message}&signature=${signature}&inviter=${INVITER_CODE}`;
    
    try {
        const response = await axios.get(url, { headers: config.headers });
        console.log(`Login Success`);
        
        // Save account and token
        await saveAccount(wallet, response.data.user.refCode);
        await saveToken(response.data.tokens);
    } catch (error) {
        console.error(`Login Failed:`);
    }
}

// Function to read tokens from a file
async function readTokens(filename) {
    try {
        const content = await fs.readFile(filename, 'utf8');
        return content.trim().split('\n').filter(token => token.length > 0);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error.message);
        return [];
    }
}

// Function to get available missions
async function getAvailableMissions(accessToken) {
    try {
        const currentDate = new Date().toISOString();
        const response = await axios.get(
            `${config.baseUrl}/questing/missions?filter%5Bdate%5D=${currentDate}&filter%5BcampaignId%5D=${config.campaignId}`,
            { headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` } }
        );
        
        return response.data.data.filter(mission => mission.progress === "0" && mission.id !== config.excludedMissionId);
    } catch (error) {
        console.error('Error fetching available missions:', error.response?.data || error.message);
        return [];
    }
}

// Function to complete a mission
async function completeMission(missionId, accessToken) {
    try {
        await axios.post(`${config.baseUrl}/questing/mission-activity/${missionId}`, {}, {
            headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` }
        });
        console.log(`Mission ${missionId} completed successfully!`);
        return true;
    } catch (error) {
        console.error(`Error completing mission ${missionId}`);
        return false;
    }
}

// Function to claim mission reward
async function claimMissionReward(missionId, accessToken) {
    try {
        await axios.post(`${config.baseUrl}/questing/mission-reward/${missionId}`, {}, {
            headers: { ...config.headers, 'authorization': `Bearer ${accessToken}` }
        });
        console.log(`Reward for mission ${missionId} claimed successfully!`);
        return true;
    } catch (error) {
        console.error(`Error claiming reward for mission ${missionId}`);
        return false;
    }
}

// Function to run the bot
async function runBot() {
    console.log(`\nCompleting Missions`);
    
    const tokens = await readTokens('token.txt');
    if (tokens.length === 0) {
        console.error('No tokens found in token.txt');
        return;
    }
    
    for (let i = 0; i < tokens.length; i++) {
        const accessToken = tokens[i];
        console.log(`\nProcessing token ${i + 1}/${tokens.length}: ${accessToken.slice(0, 20)}...`);

        const availableMissions = await getAvailableMissions(accessToken);
        if (availableMissions.length === 0) {
            console.log('No available missions to complete.');
            continue;
        }

        for (const mission of availableMissions) {
            console.log(`Processing mission: ${mission.label} (ID: ${mission.id})`);
            
            const completed = await completeMission(mission.id, accessToken);
            if (completed) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await claimMissionReward(mission.id, accessToken);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log('\nBot finished processing all tokens.');
}

// Main function to execute the bot
async function main() {
    const wallet = createWallet();
    await login(wallet);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay before executing the bot
    await runBot();
}

main().catch(error => console.error('Bot encountered an error:', error));