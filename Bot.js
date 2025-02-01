require("dotenv").config();
const { Telegraf } = require("telegraf");
const mongoose = require("mongoose");
const { Markup } = require("telegraf");

// Load environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Define User Schema
const UserSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  mobileNumber: String, // Added mobile number field
  joinedAt: { type: Date, default: Date.now },
  level: { type: Number, default: 1 },
  currentPollIndex: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
});

const User = mongoose.model("User", UserSchema);

//statics command

bot.command("statistics", async (ctx) => {
  const adminId = process.env.ADMIN_ID;  // Admin's Telegram ID

  console.log("Statistics command triggered by:", ctx.from.id); // Debugging log

  if (ctx.from.id.toString() !== adminId) {
    console.log("Unauthorized access attempt to statistics command."); // Debugging log
    return ctx.reply("You are not authorized to view the statistics.");
  }

  try {
    // Get all registered users from the database
    const users = await User.find();

    // Check if there are no users in the database
    if (users.length === 0) {
      console.log("No users in the database."); // Debugging log
      return ctx.reply("No users are registered yet.");
    }

    // Calculate the total number of users and number of levels completed
    const totalUsers = users.length;
    const levelsCompleted = users.filter(user => user.completed).length;

    // Prepare the initial part of the statistics message
    let statistics = `
      Total Users: ${totalUsers}
      Total Levels Completed: ${levelsCompleted}
      
      User Details:
    `;

    // Loop through the users and append their details
    users.forEach(user => {
      statistics += `
        Name: ${user.firstName} ${user.lastName || ''}
        Username: ${user.username || 'N/A'}
        Telegram ID: ${user.telegramId}
        Mobile Number: ${user.mobileNumber || 'Not provided'}
        Levels Completed: ${user.level-1 || 0}
        -------------------------
      `;
    });

    // Split the message into smaller chunks if it's too long
    const MAX_MESSAGE_LENGTH = 4096; // Telegram's maximum message length
    while (statistics.length > MAX_MESSAGE_LENGTH) {
      const part = statistics.slice(0, MAX_MESSAGE_LENGTH); // Take the first chunk
      await ctx.reply(part); // Send the chunk to the admin
      statistics = statistics.slice(MAX_MESSAGE_LENGTH); // Remove the sent chunk from the original string
    }

    // Send any remaining part of the message
    if (statistics.length > 0) {
      await ctx.reply(statistics);
    }

  } catch (err) {
    console.error("Error fetching statistics:", err);
    // Return a detailed error message
    ctx.reply(`An error occurred while fetching the statistics: ${err.message}`);
  }
});


// Delete User Command
bot.command("deleteuser", async (ctx) => {
  const adminId = process.env.ADMIN_ID; // केवल एडमिन को अनुमति देने के लिए

  if (ctx.from.id.toString() !== adminId) {
    return ctx.reply("❌ आप इस कमांड को उपयोग करने के लिए अधिकृत नहीं हैं।");
  }

  // कमांड से यूजर आईडी निकालना
  const args = ctx.message.text.split(" ");
  if (args.length < 2) {
    return ctx.reply("⚠ कृपया एक Telegram ID प्रदान करें। उदाहरण: `/deleteuser 123456789`");
  }

  const userId = args[1]; // यूजर ID को प्राप्त करें

  try {
    const deletedUser = await User.findOneAndDelete({ telegramId: userId });

    if (deletedUser) {
      ctx.reply(`✅ User ${userId} सफलतापूर्वक डिलीट कर दिया गया।`);
    } else {
      ctx.reply(`⚠ User ${userId} डेटाबेस में नहीं मिला।`);
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    ctx.reply("❌ यूजर को डिलीट करने में समस्या हुई।");
  }
});

// Define Poll Questions
const levelPolls = {
  1: [
    { question: "Q1: Green Revolution ka sambandh kis se hai?", options: ["Dugd utpadan se", "Krishi utpadan se", "Jal sanrakshan se", "Pashupalan se"], correctOptionId: 1 },
    { question: "Q2: Audyogik Kranti ka samaj par kaun sa prabhav pada?", options: ["Navik urja ka upyog badhna", "Shahron ki aur mass migration", "Factory system ka ant hona", "Vishv vyapar ka girna"], correctOptionId: 1 },
    { question: "Q3: Internet Revolution ka prabhav kis shetra par sabse zyada pada?", options: ["Krishi", "Shiksha", "Healthcare", "Vyapar aur samajik jeevan"], correctOptionId: 3 },
    { question: "Q4: Social media ka prarambh kis platform se hua tha?", options: ["Facebook", "Twitter", "Instagram", "MySpace"], correctOptionId: 3 },
    { question: "Q5: AI Revolution ka prarambh kis cheez se hua?", options: ["Machine Learning", "Neural Networks", "Supercomputers", "Internet of Things"], correctOptionId: 0 },
    { question: "Q6: Artificial Intelligence ka avishkar kis ne kiya?", options: ["Alan Turing", "Elon Musk", "Mark Zuckerberg", " Bill Gates"], correctOptionId: 0 },
],
  2: [
    { question: "Q1: AI ka full form kya hai?", options: ["Artificial Intelligence", "Active Intelligence", "Advanced Integration", "Automated Intelligence"], correctOptionId: 0 },
    { question: "Q2: AI ka pramukh uddeshya kya hota hai?", options: ["Machine ko human jaise decision lene mein madad karna", "Machine ko zyada power dena", "Machine ko sirf data store karna sikhana", "Machine ko robots banane mein madad karna"], correctOptionId: 0 },
    { question: "Q3: AI ka upyog kis kshetra mein sabse zyada ho raha hai?", options: ["Healthcare", "Krishi", "Vyapar", "Shiksha"], correctOptionId: 0 },
  ],
 3: [
    { question: "Q1: ChatGPT ka full form kya hai?", options: ["Chat General Processing Tool", "Chat Generative Pre-trained Transformer", "Chat Graph Processing Technology", "Chat Global Processing Transformer"], correctOptionId: 1 },
    { question: "Q2: ChatGPT kis company ne develop kiya hai?", options: ["Microsoft", "Google", "OpenAI", "IBM"], correctOptionId: 2 },
   { question: "Q3: ChatGPT kis prakar ki AI technology ka use karta hai?", options: ["Natural Language Processing (NLP)", "Virtual Reality (VR)", "Augmented Reality (AR)", "Robotics"], correctOptionId: 0 }, 
   { question: "Q4. ChatGPT ka pramukh upyog kis cheez ke liye hota hai?", options: ["Data storage", "Language translation", "Human-like conversation", "Gaming"], correctOptionId: 2 },
],
};


// Define YouTube Video Links and Thumbnails for Each Level
const levelVideos = {
  1: {
    videoLink: "https://youtu.be/g2BDiSq6jNQ?si=6-bWGq7PcitXM_Rv", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/vFtnWt3dq8U/maxresdefault.jpg", // Replace with thumbnail URL
  },
 2: {
    videoLink: "https://youtu.be/M1ULmCG0pGg?si=0j4WDlW6S3r3yoaI", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/P5cgwMkBsUI/maxresdefault.jpg", // Replace with thumbnail URL
  },
  3: {
    videoLink: "https://youtu.be/yjkBHP0XTwM?si=MkwmUQ6GJfcDRkSC", // Replace with actual YouTube link
    thumbnail: "https://img.youtube.com/vi/DAgs1P67FrQ/maxresdefault.jpg", // Replace with thumbnail URL
  },
};

// Function to Start a Level (Send Video First)
async function startLevel(ctx, user) {
  const level = user.level;

  if (levelVideos[level]) {
    const video = levelVideos[level];

    // Send thumbnail image with "Watch Video" button
    await bot.telegram.sendPhoto(user.telegramId, video.thumbnail, {
      caption: `📹 इस वीडियो को ध्यान से देखें, फिर क्विज़ शुरू होगा। Level ${level -1}`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Watch Video", url: video.videoLink }
          ]
        ]
      }
    });

    // Wait for 10 seconds before starting the quiz
    setTimeout(async () => {
      await sendNextPoll(ctx, user);
    }, 1000);
  } else {
    await sendNextPoll(ctx, user);
  }
}

// Function to Send the Next Poll
async function sendNextPoll(ctx, user) {
  const level = user.level;
  const polls = levelPolls[level];

  if (!polls || user.currentPollIndex >= polls.length) {
    if (level < Object.keys(levelPolls).length) {
      await bot.telegram.sendMessage(
        user.telegramId,
        `🎉 You completed Level ${level-1}!`,
        Markup.inlineKeyboard([
          Markup.button.callback("Next Level", `continue_${level + 1}`),
          Markup.button.callback("Change Level", "change_level"),
        ])
      );
    } else {
      await bot.telegram.sendMessage(
     user.telegramId,
 `अभी बस इतने ही लेवल्स हैं 😜. लेकिन हम जल्दी ही अगला लेवल upload करेंगे.

 नया level upload होने का नोटिफिकेशन चाहिए तो click करें 👇

        https://t.me/+IdDn8SaqValhZjQ1

जब लेवल अपलोड हो जाएगा तो /start  कमांड भेजें।

`,
);
      user.completed = true;
      await user.save();
    }
    return;
  }

  const poll = polls[user.currentPollIndex];

  await bot.telegram.sendPoll(user.telegramId, poll.question, poll.options, {
    type: "quiz",
    correct_option_id: poll.correctOptionId,
    is_anonymous: false,
  });
}

// Start Command
bot.start(async (ctx) => {
  const { id, username, first_name, last_name } = ctx.from;
 
    const from = ctx.update.message.from
    console.log('from',from)
  try {
    let user = await User.findOne({ telegramId: id });

    if (!user) {
      user = new User({
        telegramId: id,
        username: username || "N/A",
        firstName: first_name || "N/A",
        lastName: last_name || "N/A",
        level: 1,
        currentPollIndex: 0,
      });
      await user.save();

      // Ask the user for their mobile number
      await ctx.reply("Welcome to the quiz! Please provide your mobile number:");
    } else {
      await ctx.reply(`Welcome back! Resuming Level ${user.level-1}.`);
    }

    await startLevel(ctx, user);
  } catch (err) {
    console.error("Error in start command:", err);
    ctx.reply("An error occurred.");
  }
});

// Handle user's mobile number input
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const user = await User.findOne({ telegramId: userId });

  // If the user is not found or mobile number is already saved, return
  if (!user || user.mobileNumber) return;

  // Save the user's mobile number
  user.mobileNumber = ctx.message.text;
  await user.save();

  await ctx.reply("Thank you! Your mobile number has been saved.");
});

// Handle Poll Answers
bot.on("poll_answer", async (ctx) => {
  try {
    const telegramId = ctx.pollAnswer.user.id;
    const userDoc = await User.findOne({ telegramId });

    if (!userDoc) return;

    const level = userDoc.level;
    const polls = levelPolls[level];

    if (!polls || userDoc.currentPollIndex >= polls.length) {
      return;
    }

    const selectedOptionId = ctx.pollAnswer.option_ids[0];
    const correctOptionId = polls[userDoc.currentPollIndex].correctOptionId;

    if (selectedOptionId === correctOptionId) {
      userDoc.currentPollIndex += 1;
      await userDoc.save();
    }

    if (userDoc.currentPollIndex < polls.length) {
      await sendNextPoll(ctx, userDoc);
    } else {
      await bot.telegram.sendMessage(
        telegramId,
        `🎉 Level ${level-1} completed!`,
        Markup.inlineKeyboard([
          Markup.button.callback("Next Level", `continue_${level + 1}`),
          Markup.button.callback("Change Level", "change_level"),
        ])
      );
    }
  } catch (err) {
    console.error("Error handling poll answer:", err);
  }
});

// Handle Callback Queries
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const telegramId = ctx.from.id;

  try {
    let user = await User.findOne({ telegramId });

    if (!user) return ctx.reply("Please start the bot first using /start.");

    if (data.startsWith("continue_")) {
      const nextLevel = parseInt(data.split("_")[1], 10);

      user.level = nextLevel;
      user.currentPollIndex = 0;
      await user.save();

      await ctx.answerCbQuery();
      await bot.telegram.sendMessage(telegramId, `🎯 Starting Level ${nextLevel-1}!`);
      await startLevel(ctx, user);
    }

    if (data === "change_level") {
      await ctx.reply(
        "Select a level to change to:",
        Markup.inlineKeyboard([
          Markup.button.callback("Level 0", "change_to_1"),
          Markup.button.callback("Level 1", "change_to_2"),
          Markup.button.callback("Level 2", "change_to_3"), 
  ])
      );
    }

    if (data.startsWith("change_to_")) {
      const newLevel = parseInt(data.split("_")[2], 10);

      user.level = newLevel;
      user.currentPollIndex = 0;
      await user.save();

      await ctx.answerCbQuery();
      await bot.telegram.sendMessage(telegramId, `🔄 Switched to Level ${newLevel-1}!`);
      await startLevel(ctx, user);
    }
  } catch (err) {
    console.error("Error in callback query:", err);
    ctx.reply("An error occurred.");
  }
});


// Start the bot
bot.launch().catch((err) => console.error("Error starting bot:", err)); 
