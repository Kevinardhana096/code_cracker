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
  const ips = getLocalIPs();

  if (ips.length === 0) {
    console.log('  [WARNING] No network interfaces detected.');
    console.log('  Make sure USB tethering is connected.');
    return;
  }

  console.log('  Network interfaces:');
  ips.forEach((ip, i) => {
    console.log(`    [${i + 1}] ${ip.name}: http://${ip.address}:${port}`);
  });
  console.log('');
}

module.exports = { getLocalIPs, printQRInfo };
