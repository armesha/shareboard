import { v4 as uuidv4 } from 'uuid';
import { SimulatedUser } from './SimulatedUser.js';
import { TIMING } from './config.js';

export async function runScenario(profile, metrics, options = {}) {
  const workspaceId = options.workspaceId || `load-test-${uuidv4().slice(0, 8)}`;
  const users = [];
  let sharedEditToken = null;

  console.log();
  console.log(`🚀 Starting: ${profile.name}`);
  console.log(`   ${profile.description}`);
  console.log(`   Workspace: ${workspaceId}`);
  console.log();

  const rampUpDelay = profile.rampUpTime / profile.users;

  console.log('📈 Ramping up users...');

  for (let i = 0; i < profile.users; i++) {
    const userId = `load-user-${i + 1}-${uuidv4().slice(0, 6)}`;
    const user = new SimulatedUser(userId, workspaceId, metrics, null, sharedEditToken);

    try {
      await user.connect();
      if (i === 0 && user.editToken) {
        sharedEditToken = user.editToken;
        console.log(`   Edit token obtained from first user`);
      }
      user.startActivity();
      users.push(user);

      if ((i + 1) % 10 === 0 || i + 1 === profile.users) {
        console.log(`   Connected: ${i + 1}/${profile.users} users`);
      }
    } catch (error) {
      console.error(`   Failed to connect user ${i + 1}: ${error.message}`);
    }

    await sleep(rampUpDelay);
  }

  console.log();
  console.log(`✅ ${users.length}/${profile.users} users connected`);
  console.log(`⏱️  Running for ${profile.duration / 1000} seconds...`);
  console.log();

  const liveStatsInterval = setInterval(() => {
    metrics.calculateThroughput();
    metrics.recordMemory();
    metrics.printLiveStats();
  }, 1000);

  await sleep(profile.duration);

  clearInterval(liveStatsInterval);

  console.log('\n');
  console.log('📉 Disconnecting users...');

  for (const user of users) {
    user.disconnect();
    metrics.recordDisconnect();
  }

  console.log('   All users disconnected');

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

  console.log();
  console.log('🚀 Starting: Progressive Ramp-Up Test');
  console.log(`   Workspace: ${workspaceId}`);
  console.log('   Stages: 10 → 30 → 50 → 70 → 100 → 50 → 0');
  console.log();

  const liveStatsInterval = setInterval(() => {
    metrics.calculateThroughput();
    metrics.recordMemory();
    metrics.printLiveStats();
  }, 1000);

  for (let i = 0; i < stages.length - 1; i++) {
    const currentStage = stages[i];
    const targetUsers = currentStage.users;
    const currentUsers = users.length;

    console.log(`\n📊 Stage ${i + 1}: ${currentStage.name}`);

    if (targetUsers > currentUsers) {
      const toAdd = targetUsers - currentUsers;
      console.log(`   Adding ${toAdd} users...`);

      for (let j = 0; j < toAdd; j++) {
        const userId = `ramp-user-${users.length + 1}-${uuidv4().slice(0, 6)}`;
        const user = new SimulatedUser(userId, workspaceId, metrics, null, sharedEditToken);

        try {
          await user.connect();
          if (!sharedEditToken && user.editToken) {
            sharedEditToken = user.editToken;
            console.log(`   Edit token obtained from first user`);
          }
          user.startActivity();
          users.push(user);
        } catch (error) {
          console.error(`   Failed to connect: ${error.message}`);
        }

        await sleep(TIMING.RAMP_UP_DELAY);
      }
    } else if (targetUsers < currentUsers) {
      const toRemove = currentUsers - targetUsers;
      console.log(`   Removing ${toRemove} users...`);

      for (let j = 0; j < toRemove; j++) {
        const user = users.pop();
        if (user) {
          user.disconnect();
          metrics.recordDisconnect();
        }
        await sleep(50);
      }
    }

    console.log(`   Running with ${users.length} users for ${currentStage.duration / 1000}s`);
    await sleep(currentStage.duration);
  }

  clearInterval(liveStatsInterval);

  console.log('\n📉 Disconnecting remaining users...');
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

  console.log();
  console.log('🚀 Starting: Burst Test');
  console.log(`   Workspace: ${workspaceId}`);
  console.log(`   Burst size: ${burstSize} users`);
  console.log(`   Bursts: ${burstCount}`);
  console.log();

  const firstUserId = `burst-user-first-${uuidv4().slice(0, 6)}`;
  const firstUser = new SimulatedUser(firstUserId, workspaceId, metrics);
  try {
    await firstUser.connect();
    sharedEditToken = firstUser.editToken;
    console.log(`   Edit token obtained from first user`);
    firstUser.startActivity();
    users.push(firstUser);
  } catch (error) {
    console.error(`   Failed to connect first user: ${error.message}`);
  }

  const liveStatsInterval = setInterval(() => {
    metrics.calculateThroughput();
    metrics.recordMemory();
    metrics.printLiveStats();
  }, 1000);

  for (let burst = 0; burst < burstCount; burst++) {
    console.log(`\n💥 Burst ${burst + 1}/${burstCount}: Adding ${burstSize} users simultaneously`);

    const connectPromises = [];
    for (let i = 0; i < burstSize; i++) {
      const userId = `burst-user-${burst}-${i}-${uuidv4().slice(0, 6)}`;
      const user = new SimulatedUser(userId, workspaceId, metrics, null, sharedEditToken);
      users.push(user);

      connectPromises.push(
        user.connect()
          .then(() => user.startActivity())
          .catch(err => console.error(`   Connection failed: ${err.message}`))
      );
    }

    await Promise.allSettled(connectPromises);
    console.log(`   Burst complete. Active users: ${metrics.activeUsers}`);

    if (burst < burstCount - 1) {
      console.log(`   Waiting ${burstInterval / 1000}s before next burst...`);
      await sleep(burstInterval);

      console.log('   Disconnecting burst users...');
      while (users.length > 0) {
        const user = users.pop();
        user.disconnect();
        metrics.recordDisconnect();
      }
    }
  }

  console.log(`\n   Holding final burst for 60 seconds...`);
  await sleep(60000);

  clearInterval(liveStatsInterval);

  console.log('\n📉 Disconnecting all users...');
  for (const user of users) {
    user.disconnect();
    metrics.recordDisconnect();
  }

  return burstSize;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
