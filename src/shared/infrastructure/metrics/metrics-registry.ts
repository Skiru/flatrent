import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsRegistry {
  private queueLag: Record<string, number> = {};
  private outboxRetryAttempts = 0;
  private inboxRetryAttempts = 0;
  private redisDegraded = 0; // 0 = healthy, 1 = degraded

  public setQueueLag(queue: string, lagMs: number) {
    this.queueLag[queue] = lagMs;
  }

  public incrementOutboxRetry() {
    this.outboxRetryAttempts++;
  }

  public incrementInboxRetry() {
    this.inboxRetryAttempts++;
  }

  public setRedisDegraded(degraded: boolean) {
    this.redisDegraded = degraded ? 1 : 0;
  }

  public getPrometheusMetrics(): string {
    let metrics = '';

    metrics += '# HELP flatren_queue_lag_ms Age or delay of messages in a queue in milliseconds\n';
    metrics += '# TYPE flatren_queue_lag_ms gauge\n';
    for (const [queue, lag] of Object.entries(this.queueLag)) {
      metrics += `flatren_queue_lag_ms{queue="${queue}"} ${lag}\n`;
    }

    metrics += '\n# HELP flatren_outbox_retry_attempts_total Total outbox retry attempts made\n';
    metrics += '# TYPE flatren_outbox_retry_attempts_total counter\n';
    metrics += `flatren_outbox_retry_attempts_total ${this.outboxRetryAttempts}\n`;

    metrics += '\n# HELP flatren_inbox_retry_attempts_total Total inbox retry attempts made\n';
    metrics += '# TYPE flatren_inbox_retry_attempts_total counter\n';
    metrics += `flatren_inbox_retry_attempts_total ${this.inboxRetryAttempts}\n`;

    metrics +=
      '\n# HELP flatren_redis_degraded Shows if Redis cache-aside is degraded (1) or healthy (0)\n';
    metrics += '# TYPE flatren_redis_degraded gauge\n';
    metrics += `flatren_redis_degraded ${this.redisDegraded}\n`;

    return metrics;
  }
}
