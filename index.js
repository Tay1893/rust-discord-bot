const { Client, GatewayIntentBits, Partials, Events, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { Rcon } = require('rcon-client');

require('dotenv').config();

console.log("✅ ENV kontrola:");
console.log("RCON_HOST:", process.env.RCON_HOST);
console.log("RCON_PORT:", process.env.RCON_PORT);
console.log("RCON_PASSWORD:", "(skryt)");
console.log("VYJIMKA_ROLE_ID:", process.env.VYJIMKA_ROLE_ID);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, async () => {
  console.log(`Bot je online jako ${client.user.tag}`);

  // Registrace slash příkazu při startu bota
  const commands = [{
    name: 'vyjimka',
    description: 'Získat výjimku pro barevný nick'
  }];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('Slash příkaz registrován.');
  } catch (error) {
    console.error('Chyba při registraci slash příkazu:', error);
  }
});

// Event na příkazy a modaly
client.on(Events.InteractionCreate, async interaction => {
  // Pokud není slash příkaz ani modal submit, ignoruj
  if (!interaction.isChatInputCommand() && !interaction.isModalSubmit()) return;

  if (interaction.isChatInputCommand() && interaction.commandName === 'vyjimka') {
    // Sestav modal
    const modal = new ModalBuilder()
      .setCustomId('vyjimka_modal')
      .setTitle('Získání výjimky');

    const nickInput = new TextInputBuilder()
      .setCustomId('rust_nick')
      .setLabel("Zadej svůj herní nick:")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(nickInput);
    modal.addComponents(row);

    try {
      // Modal zobraz rovnou, bez zbytečných awaitů předtím
      await interaction.showModal(modal);
    } catch (err) {
      console.error("❌ Chyba při zobrazování modalu:", err);
      // Pokud modal nelze zobrazit, odešli aspoň reply
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Nepodařilo se zobrazit formulář. Zkus to prosím znovu.', ephemeral: true });
      }
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'vyjimka_modal') {
    const nick = interaction.fields.getTextInputValue('rust_nick');

    try {
      // Připoj se k RCON
      const rcon = await Rcon.connect({
        host: process.env.RCON_HOST,
        port: parseInt(process.env.RCON_PORT),
        password: process.env.RCON_PASSWORD
      });

      console.log("✅ Připojeno k RCON");

      const command = `oxide.usergroup add "${nick}" vyjimka`;
      const response = await rcon.send(command);

      console.log("📤 Odesláno:", command);
      console.log("📥 Odpověď:", response);

      await rcon.end();

      // Přidej roli uživateli na Discordu
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(process.env.VYJIMKA_ROLE_ID);

      await interaction.reply({ content: `✅ Výjimka přidána hráči **${nick}**`, ephemeral: true });
    } catch (err) {
      console.error("❌ Chyba při RCON nebo přidání role:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Nick nebyl nalezen nebo nastala chyba při přidávání výjimky. Zkontroluj správnost nicku a RCON připojení.', ephemeral: true });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
