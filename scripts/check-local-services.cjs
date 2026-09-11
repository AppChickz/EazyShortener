const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('redis');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function checkPostgres() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkRedis() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is not configured');
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: false,
    },
  });
  client.on('error', () => undefined);
  try {
    await client.connect();
    const result = await client.ping();
    if (result !== 'PONG') throw new Error('Redis did not return PONG');
  } finally {
    if (client.isOpen) await client.quit();
  }
}

function checkSmtp() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 1125);
  if (!host) return Promise.reject(new Error('SMTP_HOST is not configured'));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return Promise.reject(new Error('SMTP_PORT is invalid'));
  }

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('SMTP connection timed out'));
    }, 3000);

    socket.once('data', (data) => {
      clearTimeout(timeout);
      const greeting = data.toString('utf8');
      socket.destroy();
      if (greeting.startsWith('220')) resolve();
      else reject(new Error('SMTP server returned an unexpected greeting'));
    });
    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function main() {
  loadEnvFile();
  const checks = [
    ['PostgreSQL', checkPostgres],
    ['Redis', checkRedis],
    ['Mailpit SMTP', checkSmtp],
  ];

  let failed = false;
  for (const [name, check] of checks) {
    try {
      await check();
      console.log(`OK ${name}`);
    } catch (error) {
      failed = true;
      if (name === 'Redis') {
        const message = error instanceof Error ? error.message : '';
        const reason = /WRONGPASS|NOAUTH|AUTH/i.test(message)
          ? 'authentication failed'
          : /timeout|ETIMEDOUT/i.test(message)
            ? 'connection timed out'
            : /ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(message)
              ? 'connection failed'
              : 'check failed';
        console.error(`FAIL ${name}: ${reason}`);
      } else {
        console.error(`FAIL ${name}`);
      }
    }
  }

  if (failed) process.exitCode = 1;
}

void main();
