#!/usr/bin/env node

import { MetricsCollector } from './metrics.js';
import { runScenario, runRampUpScenario, runBurstScenario } from './scenarios.js';
import { TEST_PROFILES, SERVER_URL } from './config.js';

const HELP_TEXT = `
╔════════════════════════════════════════════════════════════════╗
║              ShareBoard Load Testing Tool                       ║
╚════════════════════════════════════════════════════════════════╝

Usage: node tests/load/index.js <command> [options]

Commands:
  10              Run test with 10 users (light load)
  30              Run test with 30 users (spec minimum)
  50              Run test with 50 users (heavy load)
  70              Run test with 70 users (stress test)
  100             Run test with 100 users (extreme stress)
  ramp            Progressive ramp-up: 10 → 30 → 50 → 70 → 100 → 50
  burst           Burst test: sudden spikes of connections
  help            Show this help message

Options:
  --workspace=ID  Use specific workspace ID
  --server=URL    Override server URL (default: ${SERVER_URL})

Examples:
  npm run load-test:30              # Test with 30 users
  npm run load-test:100             # Extreme stress test
  node tests/load/index.js ramp     # Progressive ramp-up test
  node tests/load/index.js burst    # Burst connection test

Environment Variables:
  SERVER_URL      Server URL (default: http://localhost:3000)

Test Profiles:
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('help') || args.includes('--help')) {
    console.log(HELP_TEXT);
    console.log('  Profile     Users    Duration    Description');
    console.log('  ───────────────────────────────────────────────────────');
    for (const [key, profile] of Object.entries(TEST_PROFILES)) {
      console.log(`  ${key.padEnd(12)} ${String(profile.users).padEnd(8)} ${(profile.duration / 1000 + 's').padEnd(11)} ${profile.description}`);
    }
    console.log();
    process.exit(0);
  }

  const command = args[0];
  const options = parseOptions(args.slice(1));

  if (options.server) {
    process.env.SERVER_URL = options.server;
  }

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              ShareBoard Load Testing Tool                       ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Server: ${process.env.SERVER_URL || SERVER_URL}`);

  const metrics = new MetricsCollector();
  let passed = false;

  try {
    switch (command) {
      case '10':
      case '30':
      case '50':
      case '70':
      case '100': {
        const profile = TEST_PROFILES[command];
        if (!profile) {
          console.error(`Unknown profile: ${command}`);
          process.exit(1);
        }
        await runScenario(profile, metrics, options);
        break;
      }

      case 'ramp':
        await runRampUpScenario(metrics, options);
        break;

      case 'burst':
        await runBurstScenario(metrics, options);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Use "help" to see available commands');
        process.exit(1);
    }

    passed = metrics.printFinalReport();

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(passed ? 0 : 1);
}

function parseOptions(args) {
  const options = {};

  for (const arg of args) {
    if (arg.startsWith('--workspace=')) {
      options.workspaceId = arg.slice(12);
    } else if (arg.startsWith('--server=')) {
      options.server = arg.slice(9);
    } else if (arg.startsWith('--burst-size=')) {
      options.burstSize = parseInt(arg.slice(13), 10);
    } else if (arg.startsWith('--burst-count=')) {
      options.burstCount = parseInt(arg.slice(14), 10);
    }
  }

  return options;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
