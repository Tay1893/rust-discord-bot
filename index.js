const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Events, 
  REST, 
  Routes, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder 
} = require('discord.js');
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

  // Registrace slash příkazu (jednou po startu)
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
    console.error('Chyba při registraci příkazu:', error);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'vyjimka') {
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

        await interaction.showModal(modal);  // await je důležité

        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'vyjimka_modal') {
        const nick = interaction.fields.getTextInputValue('rust_nick');

        // Připojení k RCON
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

        // Přiřazení role na Discordu
        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(process.env.VYJIMKA_ROLE_ID);

        // Odpověď uživateli
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `✅ Výjimka přidána hráči **${nick}**`, ephemeral: true });
        }
      }
    }
  } catch (err) {
    console.error("❌ Chyba v interakci:", err);

    if (interaction && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Něco se nepovedlo. Zkus to prosím znovu.', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
