import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import fs from 'node:fs';
import db from './src/database.js';
import { slashCommands, executeCommand } from './src/commands.js';
import { removeVpsContainer } from './src/nodeManager.js';

const config = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url)));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once('ready', async () => {
  console.log(`[${config.botName}] Bot successfully live: ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: slashCommands }
    );
    console.log(`[${config.hostingName}] Slash commands register ho gayi.`);
  } catch (err) {
    console.error('Commands load error:', err);
  }

  // Har 1 ghante me expired VPS ko suspend karne ka loop
  setInterval(async () => {
    const now = Date.now();
    const expired = db.prepare('SELECT * FROM vps WHERE expiresAt < ? AND autoExpiry = 1 AND isSuspended = 0').all(now);
    for (const v of expired) {
      console.log(`VPS expire ho gaya, suspending: ${v.id}`);
      await removeVpsContainer(v.id, v.name);
      db.prepare('UPDATE vps SET isSuspended = 1 WHERE id = ?').run(v.id);
    }
  }, 3600000);
});

// Slash Interaction Listener
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const options = {};
  interaction.options.data.forEach(opt => {
    options[opt.name] = opt.value ?? opt.user;
  });

  const context = {
    user: interaction.user,
    reply: (payload) => interaction.reply(payload),
    isSlash: true,
    client
  };

  await executeCommand(interaction.commandName, options, context);
});

// Prefix ($) Message Listener
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const context = {
    user: message.author,
    reply: (payload) => message.reply(payload),
    isSlash: false,
    client
  };

  await executeCommand(commandName, args, context);
});

client.login(config.token);
