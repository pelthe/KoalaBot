import { createTwitchClient } from './utils/twitchClient.js';
import { handleVisit } from './commands/visit.js';
import { handleVisitboard } from './commands/visitboard.js';
import { loadData, saveData, canVisitToday, checkAndResetStats } from './services/dataService.js';
import { Translate } from '@google-cloud/translate').v2;

// 🔑 Initialize Google Translate
const translate = new Translate({
  key: 'YOUR_GOOGLE_API_KEY' // Replace with your actual key
});

const client = createTwitchClient();

client.connect().catch(error => {
  if (error.message.includes('authentication failed')) {
    console.log('❌ Authentication error. Please check that your ACCESS_TOKEN is correct and up to date.');
  }
});

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

client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  const command = message.toLowerCase();
  const username = tags.username;
  const data = loadData();

  // User data init
  if (!data.users[username]) {
    data.users[username] = {
      totalVisits: 0,
      monthlyVisits: 0,
      yearlyVisits: 0,
      lastVisit: null
    };
  }

  // Handle visit tracking
  if (canVisitToday(data.users[username].lastVisit)) {
    data.users[username].totalVisits++;
    data.users[username].monthlyVisits++;
    data.users[username].yearlyVisits++;
    data.users[username].lastVisit = new Date().toISOString();
    saveData(data);
  }

  // Command handling
  if (command === '!visit') {
    handleVisit(client, channel, username);
  } else if (command === '!top10') {
    handleVisitboard(client, channel);
  } else if (command === '!top10m') {
    handleVisitboard(client, channel, 'monthly');
  } else if (command === '!top10y') {
    handleVisitboard(client, channel, 'yearly');
  } else if (command.startsWith('!translate')) {
    let textToTranslate = message.replace(/^!translate\s*/i, '').trim();
    const replyMsg = tags['reply-parent-msg-body'];

    if (!textToTranslate && replyMsg) {
      textToTranslate = replyMsg;
    }

    if (!textToTranslate) {
      client.say(channel, `@${username}, please provide a message to translate or reply to one.`);
      return;
    }

    try {
      const [translated] = await translate.translate(textToTranslate, 'en');
      const cleanTranslated = translated.length > 300 ? translated.substring(0, 297) + '...' : translated;
      client.say(channel, `🈯 @${username}, Translation: ${cleanTranslated}`);
    } catch (err) {
      console.error('Translation error:', err);
      client.say(channel, `@${username}, sorry, I couldn't translate that.`);
    }
  }
});

setInterval(checkAndResetStats, 3600000);
