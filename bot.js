// Import required modules
import { createTwitchClient } from './utils/twitchClient.js';
import { handleVisit } from './commands/visit.js';
import { handleVisitboard } from './commands/visitboard.js';
import { loadData, saveData, canVisitToday, checkAndResetStats } from './services/dataService.js';
import { Translate } from '@google-cloud/translate').v2;

// 🔑 Initialize Google Translate with your API key
const translate = new Translate({
  key: 'YOUR_GOOGLE_API_KEY' // Replace with your actual API key
});

// Create and connect the Twitch bot client
const client = createTwitchClient();

client.connect().catch(error => {
  if (error.message.includes('authentication failed')) {
    console.log('❌ Authentication error. Please check that your ACCESS_TOKEN is correct and up to date.');
  }
});

// Bot connected log and command list
client.on('connected', () => {
  console.log('✅ Bot connected to Twitch!');
  console.log(`📺 Channel: ${process.env.TWITCH_CHANNEL}`);
  console.log('💬 Available commands:');
  console.log('   !visit - Register a visit');
  console.log('   !top10 - View leaderboard');
  console.log('   !top10m - View monthly leaderboard');
  console.log('   !top10y - View yearly leaderboard');
  console.log('   !translate - Translate a message to English');
});

// Handle chat messages
client.on('message', async (channel, tags, message, self) => {
  if (self) return; // Ignore messages from the bot itself

  const command = message.toLowerCase(); // Convert message to lowercase for easy matching
  const username = tags.username;
  const data = loadData(); // Load visit data

  // Initialize user data if it doesn't exist
  if (!data.users[username]) {
    data.users[username] = {
      totalVisits: 0,
      monthlyVisits: 0,
      yearlyVisits: 0,
      lastVisit: null
    };
  }

  // If the user hasn't visited today, update their visit stats
  if (canVisitToday(data.users[username].lastVisit)) {
    data.users[username].totalVisits++;
    data.users[username].monthlyVisits++;
    data.users[username].yearlyVisits++;
    data.users[username].lastVisit = new Date().toISOString();
    saveData(data);
  }

  // Visit and leaderboard commands
  if (command === '!visit') {
    handleVisit(client, channel, username);
  } else if (command === '!top10') {
    handleVisitboard(client, channel);
  } else if (command === '!top10m') {
    handleVisitboard(client, channel, 'monthly');
  } else if (command === '!top10y') {
    handleVisitboard(client, channel, 'yearly');
  }

  // 🈯 TRANSLATE COMMAND
  else if (command.startsWith('!translate')) {
    // Extract the message part after the command
    let textToTranslate = message.replace(/^!translate\s*/i, '').trim();

    // Check if this message is a reply to another one, and fallback to that
    const replyMsg = tags['reply-parent-msg-body'];
    if (!textToTranslate && replyMsg) {
      textToTranslate = replyMsg;
    }

    // If no text provided and not a reply, ask for input
    if (!textToTranslate) {
      client.say(channel, `@${username}, please provide a message to translate or reply to one.`);
      return;
    }

    // Translate the message to English using Google Translate API
    try {
      const [translated] = await translate.translate(textToTranslate, 'en');

      // Truncate if it's too long for Twitch chat
      const cleanTranslated = translated.length > 300 ? translated.substring(0, 297) + '...' : translated;

      // Send translation back to chat
      client.say(channel, `🈯 @${username}, Translation: ${cleanTranslated}`);
    } catch (err) {
      console.error('Translation error:', err);
      client.say(channel, `@${username}, sorry, I couldn't translate that.`);
    }
  }
});

// Periodic check for resetting monthly/yearly stats
setInterval(checkAndResetStats, 3600000); // Every hour
