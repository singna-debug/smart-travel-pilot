
const os = require('os');
const originalHostname = os.hostname;
os.hostname = () => 'Travel-Pilot-PC';
console.log('[Fix] Hostname temporarily patched to "Travel-Pilot-PC"');
