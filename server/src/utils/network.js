const os = require('os');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }

  return ips;
}

function printQRInfo(port) {
  const config = require('../config');
  const ips = getLocalIPs();

  const printUrls = (baseUrl) => {
    console.log(`    Peserta:      ${baseUrl}`);
    console.log(`    Admin:        ${baseUrl}/?admin=1`);
    console.log(`    Leaderboard:  ${baseUrl}/?screen=leaderboard`);
    console.log(`    Layar MC:     ${baseUrl}/mc`);
  };

  console.log('  Localhost (laptop server):');
  printUrls(`http://localhost:${port}`);
  console.log('');

  if (ips.length === 0) {
    console.log('  [WARNING] No network interfaces detected.');
    console.log('  Make sure USB tethering is connected.');
  } else {
    console.log('  Network interfaces:');
    ips.forEach((ip) => {
      console.log('');
      console.log(`  ${ip.name} (${ip.address}):`);
      printUrls(`http://${ip.address}:${port}`);
    });
  }
  console.log('');

  console.log('============================================');
  console.log('  Kredensial Admin (rahasia, jangan sebar):');
  console.log(`    Password: ${config.ADMIN_PASSWORD}`);
  console.log('');
  console.log('  Kode login tim: server/data/team-login-codes.txt');
  console.log('============================================');
  console.log('');
}

module.exports = { getLocalIPs, printQRInfo };
