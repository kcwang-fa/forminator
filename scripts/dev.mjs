import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';

function isPrivateIpv4(address) {
  if (address.startsWith('10.') || address.startsWith('192.168.') || address.startsWith('169.254.')) {
    return true;
  }

  const [first, second] = address.split('.').map(Number);
  return first === 172 && second >= 16 && second <= 31;
}

function findLanIpv4() {
  const candidates = Object.entries(networkInterfaces())
    .flatMap(([name, addresses]) => (addresses || []).map((address) => ({ name, ...address })))
    .filter((address) =>
      address.family === 'IPv4' &&
      !address.internal &&
      isPrivateIpv4(address.address),
    );

  const preferred = candidates.find(({ name }) => /^(en0|eth0|wlan0|wi-fi)$/i.test(name));
  return preferred?.address || candidates[0]?.address || '';
}

function canListen(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`找不到可用的 API port（已檢查 ${startPort}-${startPort + 19}）`);
}

function startProcess(name, command, args, env = process.env) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${name} exited with signal ${signal}`);
    } else if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const apiPort = await findAvailablePort(Number(process.env.PORT) || 3000);
const apiEnv = {
  ...process.env,
  PORT: String(apiPort),
};
const api = startProcess('api', 'node', ['server.js'], apiEnv);
const lanHost = process.env.VITE_SIGN_PUBLIC_HOST || findLanIpv4();
const viteEnv = {
  ...process.env,
  VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
  ...(lanHost ? { VITE_SIGN_PUBLIC_HOST: lanHost } : {}),
};
const vite = startProcess(
  'vite',
  ['win32', 'cygwin'].includes(process.platform) ? 'npm.cmd' : 'npm',
  ['run', 'dev:vite'],
  viteEnv,
);

if (lanHost) {
  console.log(`QR signing host: ${lanHost}`);
}
console.log(`API proxy target: http://127.0.0.1:${apiPort}`);

function shutdown(signal) {
  api.kill(signal);
  vite.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
