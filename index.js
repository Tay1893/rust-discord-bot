const { 
  Client, GatewayIntentBits, Partials, Events, REST, Routes, 
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder 
} = require('discord.js');
const { Rcon } = require('rcon-client');

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const roleId = process.env.ROLE_ID;
const rconHost = process.env.RCON_HOST;
const rconPort = parseInt(process.env.RCON_PORT, 10);
const rconPassword = process.env.RCON_PASSWORD;

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

// Funkce pro připojení k RCON s retry a timeout
async function tryRconConnect(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const rcon = await Rcon.connect({
        host: rconHost,
        port: rconPort,
        password: rconPassword,
        timeout: 5000, // timeout 5 sekund
      });
      return rcon;
    } catch (err) {
      console.log(`RCON connect pokus ${i + 1} selhal, zkouším znovu...`);
      await new Promise(res => setTimeout(res, 1000)); // čeká 1 sekundu před dalším pokusem
    }
  }
  throw new Error('Nepodařilo se připojit k RCON po několika pokusech');
}

client.on(Events.InteractionCreate, async (interaction) => {
  console.log(`Interaction received: type=${interaction.type}, id=${interaction.id}`);

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

      try {
        await interaction.showModal(modal);
      } catch (err) {
        console.error('Chyba při zobrazování modalu:', err);
      }
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'vyjimkaModal') {
      await interaction.deferReply({ ephemeral: true });

      const nick = interaction.fields.getTextInputValue('nickInput');

      try {
        const rcon = await tryRconConnect();

        console.log(`Připojeno k RCON serveru na ${rconHost}:${rconPort}`);

        const response = await rcon.send(`oxide.usergroup add ${nick} vyjimka`);
        console.log(`Odpověď na přidání výjimky: ${response}`);

        await rcon.end();
        console.log('RCON spojení ukončeno.');

        const member = await interaction.guild.members.fetch(interaction.user.id);
        await member.roles.add(roleId);

        await interaction.editReply(`Výjimka přidána hráči **${nick}**.\nOdpověď serveru: ${response}`);

      } catch (error) {
        console.error('Chyba při RCON příkazu:', error);
        await interaction.editReply('Nick nebyl nalezen nebo nastala chyba při přidávání výjimky. Zkontroluj správnost nicku a RCON připojení.');
      }
    }
  }
});

// Globální handlery chyb pro lepší diagnostiku
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(token).then(() => {
  registerCommands().catch(console.error);
});
