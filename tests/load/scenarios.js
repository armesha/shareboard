import { v4 as uuidv4 } from 'uuid';
import { SimulatedUser } from './SimulatedUser.js';
import { TIMING, SERVER_URL } from './config.js';

async function pollServerMemory(metrics) {
  try {
    const res = await fetch(`${SERVER_URL}/api/health`);
    if (res.ok) {
      const data = await res.json();
      metrics.recordServerMemory(data);
    }
  } catch { /* server unreachable */ }
}

export async function runScenario(profile, metrics, options = {}) {
  const workspaceId = options.workspaceId || `load-test-${uuidv4().slice(0, 8)}`;
  const users = [];
  let sharedEditToken = null;

  console.log(`\nScenario: ${profile.name} (${profile.description})`);
  console.log(`Workspace: ${workspaceId}\n`);

  const rampUpDelay = profile.rampUpTime / profile.users;

  console.log('Ramping up users...');

  for (let i = 0; i < profile.users; i++) {
    const userId = `load-user-${i + 1}-${uuidv4().slice(0, 6)}`;
    const user = new SimulatedUser(userId, workspaceId, metrics, null, sharedEditToken);

    try {
      await user.connect();
      if (i === 0 && user.editToken) {
        sharedEditToken = user.editToken;
        console.log('Edit token obtained from first user');
      }
      user.startActivity();
      users.push(user);

      if ((i + 1) % 10 === 0 || i + 1 === profile.users) {
        console.log(`  connected ${i + 1}/${profile.users}`);
      }
    } catch (error) {
      console.error(`  failed to connect user ${i + 1}: ${error.message}`);
    }

    await sleep(rampUpDelay);
  }

  console.log(`\n${users.length}/${profile.users} users connected`);
  console.log(`Running for ${profile.duration / 1000}s\n`);

  const liveStatsInterval = setInterval(() => {
    metrics.calculateThroughput();
    metrics.recordMemory();
    pollServerMemory(metrics);
    metrics.printLiveStats();
  }, 1000);

  await sleep(profile.duration);

  clearInterval(liveStatsInterval);
  await pollServerMemory(metrics);

  console.log('\nDisconnecting users...');

  for (const user of users) {
    user.disconnect();
    metrics.recordDisconnect();
  }

  console.log('All users disconnected');

  return users.length;
}

export async function runRampUpScenario(metrics, options = {}) {
  const workspaceId = options.workspaceId || `ramp-test-${uuidv4().slice(0, 8)}`;
  const stages = [
    { users: 10, duration: 30000, name: '10 users' },
    { users: 30, duration: 60000, name: '30 users' },
    { users: 50, duration: 60000, name: '50 users' },
    { users: 70, duration: 60000, name: '70 users' },
    { users: 100, duration: 90000, name: '100 users (peak)' },
    { users: 50, duration: 30000, name: 'Ramp down to 50' },
    { users: 0, duration: 0, name: 'Complete' },
  ];

  const users = [];
  let sharedEditToken = null;

  console.log(`\nScenario: Progressive Ramp-Up`);
  console.log(`Workspace: ${workspaceId}`);
  console.log('Stages: 10 -> 30 -> 50 -> 70 -> 100 -> 50 -> 0\n');

  const liveStatsInterval = setInterval(() => {
    metrics.calculateThroughput();
    metrics.recordMemory();
    pollServerMemory(metrics);
    metrics.printLiveStats();
  }, 1000);

  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i];
    const targetUsers = currentStage.users;
    const currentUsers = users.length;

    console.log(`\nStage ${i + 1}: ${currentStage.name}`);

    if (targetUsers > currentUsers) {
      const toAdd = targetUsers - currentUsers;
      console.log(`  adding ${toAdd} users`);

      for (let j = 0; j < toAdd; j++) {
        const userId = `ramp-user-${users.length + 1}-${uuidv4().slice(0, 6)}`;
        const user = new SimulatedUser(userId, workspaceId, metrics, null, sharedEditToken);

        try {
          await user.connect();
          if (!sharedEditToken && user.editToken) {
            sharedEditToken = user.editToken;
            console.log('  edit token obtained from first user');
          }
          user.startActivity();
          users.push(user);
        } catch (error) {
          console.error(`  failed to connect: ${error.message}`);
        }

        await sleep(TIMING.RAMP_UP_DELAY);
      }
    } else if (targetUsers < currentUsers) {
      const toRemove = currentUsers - targetUsers;
      console.log(`  removing ${toRemove} users`);

      for (let j = 0; j < toRemove; j++) {
        const user = users.pop();
        if (user) {
          user.disconnect();
          metrics.recordDisconnect();
        }
        await sleep(50);
      }
    }

    console.log(`  running with ${users.length} users for ${currentStage.duration / 1000}s`);
    await sleep(currentStage.duration);
  }

  clearInterval(liveStatsInterval);

  console.log('\nDisconnecting remaining users...');
  for (const user of users) {
    user.disconnect();
    metrics.recordDisconnect();
  }

  return stages.reduce((max, s) => Math.max(max, s.users), 0);
}

export async function runBurstScenario(metrics, options = {}) {
  const workspaceId = options.workspaceId || `burst-test-${uuidv4().slice(0, 8)}`;
  const burstSize = options.burstSize || 50;
  const burstCount = options.burstCount || 3;
  const burstInterval = options.burstInterval || 30000;

  const users = [];
  let sharedEditToken = null;

  console.log(`\nScenario: Burst Test`);
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Burst size: ${burstSize} users`);
  console.log(`Bursts: ${burstCount}\n`);

  const firstUserId = `burst-user-first-${uuidv4().slice(0, 6)}`;
  const firstUser = new SimulatedUser(firstUserId, workspaceId, metrics);
  try {
    await firstUser.connect();
    sharedEditToken = firstUser.editToken;
    console.log('Edit token obtained from first user');
    firstUser.startActivity();
    users.push(firstUser);
  } catch (error) {
    console.error(`Failed to connect first user: ${error.message}`);
  }

  const liveStatsInterval = setInterval(() => {
    metrics.calculateThroughput();
    metrics.recordMemory();
    pollServerMemory(metrics);
    metrics.printLiveStats();
  }, 1000);

  for (let burst = 0; burst < burstCount; burst++) {
    console.log(`\nBurst ${burst + 1}/${burstCount}: adding ${burstSize} users simultaneously`);

    const connectPromises = [];
    for (let i = 0; i < burstSize; i++) {
      const userId = `burst-user-${burst}-${i}-${uuidv4().slice(0, 6)}`;
      const user = new SimulatedUser(userId, workspaceId, metrics, null, sharedEditToken);
      users.push(user);

      connectPromises.push(
        user.connect()
          .then(() => user.startActivity())
          .catch(err => console.error(`  connection failed: ${err.message}`))
      );
    }

    await Promise.allSettled(connectPromises);
    console.log(`  burst complete, active users: ${metrics.activeUsers}`);

    if (burst < burstCount - 1) {
      console.log(`  waiting ${burstInterval / 1000}s before next burst`);
      await sleep(burstInterval);

      console.log('  disconnecting burst users');
      while (users.length > 0) {
        const user = users.pop();
        user.disconnect();
        metrics.recordDisconnect();
      }
    }
  }

  console.log(`\nHolding final burst for 60s`);
  await sleep(60000);

  clearInterval(liveStatsInterval);

  console.log('\nDisconnecting all users...');
  for (const user of users) {
    user.disconnect();
    metrics.recordDisconnect();
  }

  return burstSize;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
