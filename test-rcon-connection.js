// test-rcon-connection.js
const net = require('net');

const host = process.env.RCON_HOST;
const port = parseInt(process.env.RCON_PORT, 10);
const timeout = 3000;

const socket = new net.Socket();

console.log(`🔌 Zkouším se připojit na ${host}:${port}...`);

socket.setTimeout(timeout);

socket.on('connect', () => {
  console.log('✅ Připojeno! Port je dostupný.');
  socket.destroy();
  process.exit(0);
});

socket.on('timeout', () => {
  console.log('⏱️ Timeout: Port je pravděpodobně nedostupný.');
  socket.destroy();
  process.exit(1);
});

socket.on('error', (err) => {
  console.log(`❌ Chyba při připojení: ${err.message}`);
  socket.destroy();
  process.exit(1);
});

socket.connect(port, host);
