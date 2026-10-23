/**
 * Creates a store super admin (docs/PORTAL_ACCESS.md, phase A3). Run once per environment, in a terminal:
 *
 *   cd server && npm run staff:bootstrap
 *
 * Either a new store login (asks name, email and password; the password is never echoed or logged)
 * or a link to an existing Homecare login, for someone who works in both.
 */
import readline from 'node:readline/promises';
import { storePool, userPool } from '../db/mysql.js';
import { StaffService } from '../services/staffService.js';
import { normalizeEmail, passwordProblem } from '../utils/staffAccounts.js';

async function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it. */
function askHidden(prompt: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    return Promise.reject(new Error('Run this in a terminal, so the password is not echoed.'));
  }
  return new Promise((resolve) => {
    let value = '';
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          finish();
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function yes(question: string): Promise<boolean> {
  return /^y(es)?$/i.test(await ask(`${question} (y/N) `));
}

async function newStoreLogin() {
  const name = await ask('Name: ');
  const email = normalizeEmail(await ask('Work email: '));
  if (!email) throw new Error('That is not a valid email.');

  const existing = (await StaffService.list()).find((s) => s.kind === 'store' && s.email === email);
  if (existing) {
    if (existing.isSuperAdmin && existing.active) {
      console.log(`${existing.name} is already an active super admin.`);
      return;
    }
    if (await yes(`${existing.name} already has a store login. Make it an active super admin?`)) {
      await StaffService.promoteToSuperAdmin(existing.id);
      console.log(`${existing.name} is now a super admin.`);
    }
    return;
  }

  const password = await askHidden('Password (at least 10 characters): ');
  const problem = passwordProblem(password, { email });
  if (problem) throw new Error(problem);
  if ((await askHidden('Same password again: ')) !== password) throw new Error('The two passwords differ.');

  const created = await StaffService.createStoreLogin(null, { name, email }, { superAdmin: true, password });
  console.log(`Created super admin ${name} <${email}> (staff id ${created.id}). Sign in to the portal with that email.`);
}

async function linkHomecareLogin() {
  const email = normalizeEmail(await ask('Their Homecare email: '));
  if (!email) throw new Error('That is not a valid email.');

  const linked = (await StaffService.list()).find((s) => s.kind === 'linked' && s.email === email);
  if (linked) {
    if (linked.isSuperAdmin && linked.active) {
      console.log(`${linked.name} is already an active super admin.`);
      return;
    }
    if (await yes(`${linked.name} is already linked. Make them an active super admin?`)) {
      await StaffService.promoteToSuperAdmin(linked.id);
      console.log(`${linked.name} is now a super admin.`);
    }
    return;
  }

  const match = await StaffService.homecareMatch(email);
  if (!(await yes(`Found ${match.name} <${match.email}>. Link them as a store super admin?`))) return;
  const id = await StaffService.linkHomecare(null, email, { superAdmin: true });
  console.log(`Linked ${match.name} as super admin (staff id ${id}). They sign in with their Homecare password.`);
}

async function main() {
  const staff = await StaffService.list();
  const supers = staff.filter((s) => s.isSuperAdmin && s.active);
  if (supers.length) {
    console.log(`Active super admins: ${supers.map((s) => `${s.name} <${s.email}>`).join(', ')}`);
    if (!(await yes('Add another?'))) return;
  }

  console.log('1) New store login\n2) Link a Homecare login (someone who works in both)');
  const choice = await ask('Choose 1 or 2: ');
  if (choice === '1') await newStoreLogin();
  else if (choice === '2') await linkHomecareLogin();
  else throw new Error('Choose 1 or 2.');
}

main()
  .then(() => 0)
  .catch((err) => {
    console.error(err?.message || err);
    return 1;
  })
  .then(async (code) => {
    await Promise.allSettled([storePool.end(), userPool.end()]);
    process.exit(code);
  });
