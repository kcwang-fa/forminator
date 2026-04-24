import { spawn } from 'node:child_process';

function startProcess(name, command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
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

const api = startProcess('api', 'node', ['server.js']);
const vite = startProcess('vite', ['win32', 'cygwin'].includes(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev:vite']);

function shutdown(signal) {
  api.kill(signal);
  vite.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
