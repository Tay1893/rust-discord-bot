require('dotenv').config();
const { 
  Client, GatewayIntentBits, Partials, Routes, REST, ModalBuilder, 
  TextInputBuilder, TextInputStyle, ActionRowBuilder, InteractionType 
} = require('discord.js');
const Rcon = require('rcon-srcds');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const RCON_HOST = process.env.RCON_HOST;
const RCON_PORT = parseInt(process.env.RCON_PORT);
const RCON_PASSWORD = process.env.RCON_PASSWORD;
const VYJIMKA_ROLE_ID = process.env.VYJIMKA_ROLE_ID;

// 🧪 Výpis proměnných prostředí
console.log("✅ ENV kontrola:");
console.log("RCON_HOST:", RCON_HOST);
console.log("RCON_PORT:", RCON_PORT);
console.log("RCON_PASSWORD:", RCON_PASSWORD ? "(skryt)" : "❌ chybí");
console.log("VYJIMKA_ROLE_ID:", VYJIMKA_ROLE_ID);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

const commands = [
  {
    name: 'vyjimka',
    description: 'Získat výjimku pro barevný nick.'
  }
];

const rest = new REST({ version: '10' }).setToken(token);

client.once('ready', async () => {
  console.log(`Bot je online jako ${client.user.tag}`);

  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Slash příkaz registrován.');
  } catch (error) {
    console.error('❌ Chyba při registraci příkazu:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'vyjimka') {
      const modal = new ModalBuilder()
        .setCustomId('vyjimkaModal')
        .setTitle('Žádost o výjimku')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('nick')
              .setLabel('Zadej svůj herní nick')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);

    } else if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'vyjimkaModal') {
      const nick = interaction.fields.getTextInputValue('nick');

      await interaction.reply({ content: `⏳ Ověřuji nick: ${nick}`, ephemeral: true });

      try {
        await tryRconConnect(nick, interaction);
        await interaction.editReply({ content: `✅ Výjimka udělena hráči \`${nick}\` a role přidána.` });
      } catch (error) {
        console.error('❌ Chyba při RCON nebo přidání role:', error);
        await interaction.editReply({ content: `❌ Chyba: ${error.message}` });
      }
    }
  } catch (error) {
    console.error('❌ Chyba v interactionCreate:', error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Nastala chyba při zpracování interakce.', ephemeral: true });
    }
  }
});

async function tryRconConnect(nick, interaction) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 3;

    function attempt() {
      attempts++;
      console.log(`🔌 RCON pokus ${attempts}...`);
      const conn = new Rcon(RCON_HOST, RCON_PORT, RCON_PASSWORD);

      conn.on('auth', () => {
        console.log('✅ RCON přihlášení úspěšné.');
        conn.send(`oxide.usergroup add ${nick} vyjimka`);
      });

      conn.on('response', async (str) => {
        console.log('RCON response:', str);
        conn.disconnect();

        try {
          const member = interaction.guild.members.cache.get(interaction.user.id);
          if (!member) {
            reject(new Error('Uživatel nenalezen v guildě.'));
            return;
          }
          const role = interaction.guild.roles.cache.get(VYJIMKA_ROLE_ID);
          if (!role) {
            reject(new Error('Role nenalezena na serveru.'));
            return;
          }
          await member.roles.add(role);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      conn.on('error', (err) => {
        console.error(`❌ RCON chyba:`, err);
        if (attempts < maxAttempts) {
          setTimeout(attempt, 1000);
        } else {
          reject(new Error('Nepodařilo se připojit k RCON po několika pokusech'));
        }
      });

      conn.on('end', () => {
        console.log('🔌 RCON odpojeno.');
      });

      conn.connect();
    }

    attempt();
  });
}

client.login(token);
