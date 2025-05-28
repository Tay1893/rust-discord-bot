const express = require('express');
const { 
  Client, GatewayIntentBits, Partials, Events, REST, Routes, 
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder 
} = require('discord.js');
const { Rcon } = require('rcon-client');

const token = process.env.DISCORD_TOKEN;
const guildId = '1241679045360484362';
const roleId = '1377265027819765801';
const rconHost = '185.180.2.124';
const rconPort = 28395;
const rconPassword = '786i0knd';

// --- EXPRESS SERVER PRO RENDER ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot je online');
});

app.listen(PORT, () => {
  console.log(`HTTP server běží na portu ${PORT}`);
});
// --- KONEC EXPRESS SERVERU ---

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, () => {
  console.log(`Bot je online jako ${client.user.tag}`);
});

async function registerCommands() {
  const commands = [
    {
      name: 'vyjimka',
      description: 'Přidá hráči výjimku',
    },
  ];
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log('Slash příkaz registrován.');
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'vyjimka') {
      const modal = new ModalBuilder()
        .setCustomId('vyjimkaModal')
        .setTitle('Přidání výjimky');

      const nickInput = new TextInputBuilder()
        .setCustomId('nickInput')
        .setLabel("Zadej svůj herní nick")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Tvůj Rust nick')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(nickInput);
      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'vyjimkaModal') {
      await interaction.deferReply({ ephemeral: true });

      const nick = interaction.fields.getTextInputValue('nickInput');

      try {
        const rcon = await Rcon.connect({
          host: rconHost,
          port: rconPort,
          password: rconPassword,
        });

        const response = await rcon.send(`oxide.usergroup add ${nick} vyjimka`);
        rcon.end();

        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(roleId);

        await interaction.editReply(`Výjimka přidána hráči **${nick}**.\nOdpověď serveru: ${response}`);
      } catch (error) {
        console.error(error);
        await interaction.editReply('Nick nebyl nalezen nebo nastala chyba při přidávání výjimky. Zkontroluj správnost nicku a RCON připojení.');
      }
    }
  }
});

client.login(token).then(() => {
  registerCommands().catch(console.error);
});
