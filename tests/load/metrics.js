import { THRESHOLDS } from './config.js';

export class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.connectTimes = [];
    this.sendTimes = [];
    this.receiveCounts = 0;
    this.errors = [];
    this.activeUsers = 0;
    this.peakUsers = 0;
    this.memorySnapshots = [];
    this.throughputHistory = [];
    this.lastThroughputCheck = Date.now();
    this.messagesSinceLastCheck = 0;
  }

  recordConnect(latency) {
    this.connectTimes.push(latency);
    this.activeUsers++;
    this.peakUsers = Math.max(this.peakUsers, this.activeUsers);
  }

  recordDisconnect() {
    this.activeUsers--;
  }

  recordSend(timestamp) {
    this.sendTimes.push(timestamp);
    this.messagesSinceLastCheck++;
  }

  recordReceive() {
    this.receiveCounts++;
  }

  recordError(message) {
    this.errors.push({
      time: Date.now(),
      message,
    });
  }

  recordMemory() {
    const used = process.memoryUsage();
    this.memorySnapshots.push({
      time: Date.now(),
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
    });
  }

  calculateThroughput() {
    const now = Date.now();
    const elapsed = (now - this.lastThroughputCheck) / 1000;

    if (elapsed >= 1) {
      const throughput = this.messagesSinceLastCheck / elapsed;
      this.throughputHistory.push({
        time: now,
        value: throughput,
      });
      this.messagesSinceLastCheck = 0;
      this.lastThroughputCheck = now;
      return throughput;
    }
    return null;
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getStats() {
    const duration = (Date.now() - this.startTime) / 1000;
    const totalMessages = this.sendTimes.length + this.receiveCounts;
    const avgThroughput = this.throughputHistory.length > 0
      ? this.throughputHistory.reduce((sum, t) => sum + t.value, 0) / this.throughputHistory.length
      : totalMessages / duration;

    const connectLatencies = this.connectTimes;
    const errorRate = this.errors.length / Math.max(1, totalMessages);

    return {
      duration: Math.round(duration),
      totalMessages,
      messagesSent: this.sendTimes.length,
      messagesReceived: this.receiveCounts,
      activeUsers: this.activeUsers,
      peakUsers: this.peakUsers,
      errors: this.errors.length,
      errorRate: (errorRate * 100).toFixed(2),

      connectLatency: {
        min: Math.min(...connectLatencies, 0),
        max: Math.max(...connectLatencies, 0),
        avg: connectLatencies.length > 0
          ? Math.round(connectLatencies.reduce((a, b) => a + b, 0) / connectLatencies.length)
          : 0,
        p95: Math.round(this.percentile(connectLatencies, 95)),
        p99: Math.round(this.percentile(connectLatencies, 99)),
      },

      throughput: {
        avg: avgThroughput.toFixed(2),
        peak: this.throughputHistory.length > 0
          ? Math.max(...this.throughputHistory.map(t => t.value)).toFixed(2)
          : '0',
        current: this.throughputHistory.length > 0
          ? this.throughputHistory[this.throughputHistory.length - 1].value.toFixed(2)
          : '0',
      },

      memory: this.memorySnapshots.length > 0
        ? this.memorySnapshots[this.memorySnapshots.length - 1]
        : { heapUsed: 0, heapTotal: 0, rss: 0 },
    };
  }

  checkThresholds() {
    const stats = this.getStats();
    const failures = [];

    if (stats.connectLatency.p95 > THRESHOLDS.MAX_LATENCY_P95) {
      failures.push(`P95 latency ${stats.connectLatency.p95}ms exceeds threshold ${THRESHOLDS.MAX_LATENCY_P95}ms`);
    }

    if (stats.connectLatency.p99 > THRESHOLDS.MAX_LATENCY_P99) {
      failures.push(`P99 latency ${stats.connectLatency.p99}ms exceeds threshold ${THRESHOLDS.MAX_LATENCY_P99}ms`);
    }

    if (parseFloat(stats.errorRate) > THRESHOLDS.MAX_ERROR_RATE * 100) {
      failures.push(`Error rate ${stats.errorRate}% exceeds threshold ${THRESHOLDS.MAX_ERROR_RATE * 100}%`);
    }

    if (parseFloat(stats.throughput.avg) < THRESHOLDS.MIN_THROUGHPUT) {
      failures.push(`Throughput ${stats.throughput.avg} msg/s below threshold ${THRESHOLDS.MIN_THROUGHPUT} msg/s`);
    }

    return {
      passed: failures.length === 0,
      failures,
    };
  }

  printLiveStats() {
    const stats = this.getStats();
    process.stdout.write('\r\x1b[K');
    process.stdout.write(
      `Users: ${stats.activeUsers}/${stats.peakUsers} | ` +
      `Msgs: ${stats.totalMessages} | ` +
      `Throughput: ${stats.throughput.current} msg/s | ` +
      `Errors: ${stats.errors} | ` +
      `Memory: ${stats.memory.heapUsed}MB`
    );
  }

  printFinalReport() {
    const stats = this.getStats();
    const threshold = this.checkThresholds();

    console.log('\n');
    console.log('═'.repeat(60));
    console.log('                    LOAD TEST RESULTS');
    console.log('═'.repeat(60));
    console.log();

    console.log('📊 SUMMARY');
    console.log('─'.repeat(40));
    console.log(`  Duration:        ${stats.duration}s`);
    console.log(`  Peak Users:      ${stats.peakUsers}`);
    console.log(`  Total Messages:  ${stats.totalMessages}`);
    console.log(`    ├─ Sent:       ${stats.messagesSent}`);
    console.log(`    └─ Received:   ${stats.messagesReceived}`);
    console.log();

    console.log('⚡ THROUGHPUT');
    console.log('─'.repeat(40));
    console.log(`  Average:         ${stats.throughput.avg} msg/s`);
    console.log(`  Peak:            ${stats.throughput.peak} msg/s`);
    console.log();

    console.log('🕐 LATENCY (Connection)');
    console.log('─'.repeat(40));
    console.log(`  Min:             ${stats.connectLatency.min}ms`);
    console.log(`  Max:             ${stats.connectLatency.max}ms`);
    console.log(`  Average:         ${stats.connectLatency.avg}ms`);
    console.log(`  P95:             ${stats.connectLatency.p95}ms`);
    console.log(`  P99:             ${stats.connectLatency.p99}ms`);
    console.log();

    console.log('❌ ERRORS');
    console.log('─'.repeat(40));
    console.log(`  Total:           ${stats.errors}`);
    console.log(`  Error Rate:      ${stats.errorRate}%`);

    if (this.errors.length > 0 && this.errors.length <= 10) {
      console.log('  Recent errors:');
      this.errors.slice(-5).forEach(e => {
        console.log(`    - ${e.message}`);
      });
    }
    console.log();

    console.log('💾 MEMORY (Test Client)');
    console.log('─'.repeat(40));
    console.log(`  Heap Used:       ${stats.memory.heapUsed}MB`);
    console.log(`  Heap Total:      ${stats.memory.heapTotal}MB`);
    console.log(`  RSS:             ${stats.memory.rss}MB`);
    console.log();

    console.log('═'.repeat(60));
    if (threshold.passed) {
      console.log('  ✅ TEST PASSED - All thresholds met');
    } else {
      console.log('  ❌ TEST FAILED - Threshold violations:');
      threshold.failures.forEach(f => console.log(`     - ${f}`));
    }
    console.log('═'.repeat(60));
    console.log();

    return threshold.passed;
  }
}
