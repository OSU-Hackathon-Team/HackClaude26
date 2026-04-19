type TimelineInteractionPayload = {
  action: string;
  month: number;
  treatment: string;
  organ: string;
  isPlaying?: boolean;
};

interface PersistedMetrics {
  totalSessions: number;
  sessionsUsingTimelineControls: number;
}

interface TimelineDropoffPoint {
  month: number;
  treatment: string;
  organ: string;
  lastAction: string;
  isPlaying: boolean;
  at: number;
}

const METRICS_STORAGE_KEY = 'oncopath:product-metrics:v1';
const EVENT_STORAGE_KEY = 'oncopath:product-metric-events:v1';
const MAX_EVENT_LOG = 100;

const session = {
  started: false,
  id: '',
  startPerfMs: 0,
  hasTimelineInteraction: false,
  firstExplanationTracked: false,
  dropoffPoint: null as TimelineDropoffPoint | null,
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function createSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readPersistedMetrics(): PersistedMetrics {
  if (!isBrowser()) {
    return { totalSessions: 0, sessionsUsingTimelineControls: 0 };
  }

  try {
    const raw = window.localStorage.getItem(METRICS_STORAGE_KEY);
    if (!raw) {
      return { totalSessions: 0, sessionsUsingTimelineControls: 0 };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedMetrics> | null;
    return {
      totalSessions: Number.isFinite(parsed?.totalSessions) ? Number(parsed?.totalSessions) : 0,
      sessionsUsingTimelineControls: Number.isFinite(parsed?.sessionsUsingTimelineControls)
        ? Number(parsed?.sessionsUsingTimelineControls)
        : 0,
    };
  } catch {
    return { totalSessions: 0, sessionsUsingTimelineControls: 0 };
  }
}

function writePersistedMetrics(metrics: PersistedMetrics): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(metrics));
}

function pushMetricEvent(name: string, payload: Record<string, unknown>): void {
  if (!isBrowser()) {
    return;
  }

  const event = {
    name,
    payload,
    sessionId: session.id,
    at: new Date().toISOString(),
  };

  try {
    const raw = window.localStorage.getItem(EVENT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown[]) : [];
    const next = [...parsed, event].slice(-MAX_EVENT_LOG);
    window.localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op: local metric persistence should never break UX flow
  }

  console.info('[metrics]', event);
}

function markTimelineControlUsage(): void {
  const metrics = readPersistedMetrics();
  metrics.sessionsUsingTimelineControls += 1;
  writePersistedMetrics(metrics);

  const usagePercent = metrics.totalSessions
    ? Number(((metrics.sessionsUsingTimelineControls / metrics.totalSessions) * 100).toFixed(2))
    : 0;

  pushMetricEvent('timeline_controls_session_adoption', {
    usagePercent,
    sessionsUsingTimelineControls: metrics.sessionsUsingTimelineControls,
    totalSessions: metrics.totalSessions,
  });
}

export function startProductMetricsSession(): void {
  if (!isBrowser() || session.started) {
    return;
  }

  session.started = true;
  session.id = createSessionId();
  session.startPerfMs = window.performance.now();
  session.hasTimelineInteraction = false;
  session.firstExplanationTracked = false;
  session.dropoffPoint = null;

  const metrics = readPersistedMetrics();
  metrics.totalSessions += 1;
  writePersistedMetrics(metrics);

  pushMetricEvent('session_started', {
    totalSessions: metrics.totalSessions,
  });
}

export function updateTimelineDropoffCandidate(payload: TimelineInteractionPayload): void {
  if (!session.started) {
    startProductMetricsSession();
  }

  session.dropoffPoint = {
    month: payload.month,
    treatment: payload.treatment,
    organ: payload.organ,
    lastAction: payload.action,
    isPlaying: payload.isPlaying ?? false,
    at: Date.now(),
  };
}

export function trackTimelineControlInteraction(payload: TimelineInteractionPayload): void {
  if (!session.started) {
    startProductMetricsSession();
  }

  if (!session.hasTimelineInteraction) {
    session.hasTimelineInteraction = true;
    markTimelineControlUsage();
  }

  updateTimelineDropoffCandidate(payload);
  pushMetricEvent('timeline_control_interaction', {
    ...payload,
  });
}

export function trackTimeToFirstExplanation(source: 'assistant' | 'fallback'): void {
  if (!session.started) {
    startProductMetricsSession();
  }

  if (session.firstExplanationTracked) {
    return;
  }

  session.firstExplanationTracked = true;
  const elapsedMs = Math.round(window.performance.now() - session.startPerfMs);
  pushMetricEvent('time_to_first_explanation', {
    source,
    elapsedMs,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(2)),
  });
}

export function flushTimelineDropoff(reason: 'visibility_hidden' | 'session_end' | 'component_unmount'): void {
  if (!session.started || !session.dropoffPoint) {
    return;
  }

  pushMetricEvent('timeline_dropoff_point', {
    reason,
    ...session.dropoffPoint,
  });
}
