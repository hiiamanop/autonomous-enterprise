export type TrafficMode = 'NORMAL' | 'FLASH_SALE' | 'CHAOS';

export interface SimulatorStatus {
  isRunning: boolean;
  mode: TrafficMode;
  intervalMs: number;
  totalTicks: number;
  successfulActions: number;
  failedActions: number;
  pausedByRateLimit: boolean;
  rateLimitCooldownSeconds: number;
  lastAction?: string;
  lastActor?: string;
  lastSpeechBubble?: string;
  lastTimestamp?: string;
}

export interface SimulatorConfigDto {
  mode?: TrafficMode;
  intervalMs?: number;
  autoAiReasoning?: boolean;
}
