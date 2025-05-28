const { Client, GatewayIntentBits, Partials, Events, REST, Routes } = require('discord.js');
const { Rcon } = require('rcon-client');

const token = process.env.DISCORD_TOKEN;
const guildId = '1241679045360484362';
const roleId = '1377265027819765801';
const rconHost = '185.180.2.124';
const rconPort = 28395;
const rconPassword = '786i0knd';

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
      options: [
        {
          name: 'nick',
          type: 3,
          description: 'Rust nick hráče',
          required: true,
        },
      ],
    },
  ];
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
  console.log('Slash příkaz registrován.');
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'vyjimka') {
    const nick = interaction.options.getString('nick');

    await interaction.deferReply({ ephemeral: true });

    try {
      const rcon = await Rcon.connect({
        host: rconHost,
        port: rconPort,
        password: rconPassword,
      });

      const response = await rcon.send(`oxide.usergroup add ${nick} vyjimka`);

      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(roleId);

      await interaction.editReply(`Výjimka přidána hráči **${nick}**.\nOdpověď serveru: ${response}`);

      rcon.end();
    } catch (error) {
      console.error(error);
      await interaction.editReply('Nastala chyba při přidávání výjimky. Zkontroluj nick a RCON připojení.');
    }
  }
});

client.login(token).then(() => {
  registerCommands().catch(console.error);
});
