import { THRESHOLDS } from './config.js';

export class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = Date.now();
    this.connectTimes = [];
    this.messageLatencies = [];
    this.sendTimes = [];
    this.receiveCounts = 0;
    this.errors = [];
    this.activeUsers = 0;
    this.peakUsers = 0;
    this.memorySnapshots = [];
    this.serverMemorySnapshots = [];
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

  recordMessageLatency(latency) {
    if (latency >= 0 && latency < 30000) {
      this.messageLatencies.push(latency);
    }
  }

  recordServerMemory(memoryData) {
    this.serverMemorySnapshots.push({
      time: Date.now(),
      ...memoryData,
    });
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
        samples: connectLatencies.length,
      },

      messageLatency: (() => {
        const ml = this.messageLatencies;
        if (ml.length === 0) return { min: 0, max: 0, avg: 0, p95: 0, p99: 0, samples: 0 };
        let min = ml[0], max = ml[0], sum = 0;
        for (let i = 0; i < ml.length; i++) {
          if (ml[i] < min) min = ml[i];
          if (ml[i] > max) max = ml[i];
          sum += ml[i];
        }
        return {
          min, max,
          avg: Math.round(sum / ml.length),
          p95: Math.round(this.percentile(ml, 95)),
          p99: Math.round(this.percentile(ml, 99)),
          samples: ml.length,
        };
      })(),

      serverMemory: this.serverMemorySnapshots.length > 0
        ? this.serverMemorySnapshots[this.serverMemorySnapshots.length - 1]
        : null,

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

    const latencyStats = stats.messageLatency.samples > 0 ? stats.messageLatency : stats.connectLatency;

    if (latencyStats.p95 > THRESHOLDS.MAX_LATENCY_P95) {
      failures.push(`P95 latency ${latencyStats.p95}ms exceeds threshold ${THRESHOLDS.MAX_LATENCY_P95}ms`);
    }

    if (latencyStats.p99 > THRESHOLDS.MAX_LATENCY_P99) {
      failures.push(`P99 latency ${latencyStats.p99}ms exceeds threshold ${THRESHOLDS.MAX_LATENCY_P99}ms`);
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
    const msgLat = stats.messageLatency.samples > 0 ? `${stats.messageLatency.avg}ms` : '-';
    const srvMem = stats.serverMemory ? `${stats.serverMemory.heapUsed}MB` : '-';
    process.stdout.write(
      `Users: ${stats.activeUsers}/${stats.peakUsers} | ` +
      `Msgs: ${stats.totalMessages} | ` +
      `${stats.throughput.current} msg/s | ` +
      `Lat: ${msgLat} | ` +
      `Err: ${stats.errors} | ` +
      `Srv: ${srvMem}`
    );
  }

  printFinalReport() {
    const stats = this.getStats();
    const threshold = this.checkThresholds();

    console.log('\nResults');
    console.log(`  duration         ${stats.duration}s`);
    console.log(`  peak users       ${stats.peakUsers}`);
    console.log(`  messages         ${stats.totalMessages} (sent ${stats.messagesSent}, received ${stats.messagesReceived})`);
    console.log(`  throughput       ${stats.throughput.avg} msg/s avg, ${stats.throughput.peak} msg/s peak`);

    const ml = stats.messageLatency;
    if (ml.samples > 0) {
      console.log(`  latency avg      ${ml.avg} ms`);
      console.log(`  latency p95      ${ml.p95} ms`);
      console.log(`  latency p99      ${ml.p99} ms`);
      console.log(`  latency min/max  ${ml.min} / ${ml.max} ms (${ml.samples} samples)`);
    } else {
      console.log('  latency          no samples');
    }

    console.log(`  connect latency  avg ${stats.connectLatency.avg} ms, p95 ${stats.connectLatency.p95} ms (${stats.connectLatency.samples} samples)`);
    console.log(`  errors           ${stats.errors} (${stats.errorRate}%)`);

    if (this.errors.length > 0 && this.errors.length <= 10) {
      this.errors.slice(-5).forEach(e => console.log(`    - ${e.message}`));
    }

    if (stats.serverMemory) {
      console.log(`  server memory    heap ${stats.serverMemory.heapUsed} MB, RSS ${stats.serverMemory.rss} MB`);
    }
    console.log(`  client memory    heap ${stats.memory.heapUsed} MB, RSS ${stats.memory.rss} MB`);

    if (threshold.passed) {
      console.log('\nResult: PASS');
    } else {
      console.log('\nResult: FAIL');
      threshold.failures.forEach(f => console.log(`  - ${f}`));
    }
    console.log();

    return threshold.passed;
  }
}
