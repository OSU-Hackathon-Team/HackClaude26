import {
  TIMELINE_TREATMENT_PRESETS,
  type TreatmentPresetId,
} from '@/lib/timeline';

type TimelineTool =
  | 'set_treatment'
  | 'set_month'
  | 'play_timeline'
  | 'pause_timeline'
  | 'focus_organ';

export interface TimelineCommandResult {
  ok: boolean;
  message: string;
  appliedTool?: TimelineTool;
}

export interface TimelineCommandContext {
  monthMin: number;
  monthMax: number;
  organOptions: { key: string; label: string }[];
  setTreatment: (treatment: TreatmentPresetId) => void;
  setMonth: (month: number) => void;
  focusOrgan: (organKey: string) => void;
  setPlayback: (options: { playing: boolean; speed?: number; cycleCount?: number | null }) => void;
  appendActionLog: (entry: string) => void;
}

const TREATMENT_BY_ID = new Map(
  TIMELINE_TREATMENT_PRESETS.map((preset) => [preset.id, preset.label])
);

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseCommandPayload(
  rawCommand: unknown
): { tool: TimelineTool; arguments: Record<string, unknown> } | null {
  const root = asObject(rawCommand);
  if (!root) {
    return null;
  }

  let payload = root;
  if ('result' in payload) {
    const nested = asObject(payload.result);
    if (nested) {
      payload = nested;
    }
  }

  let toolName: string | null = null;
  if (typeof payload.tool === 'string') {
    toolName = payload.tool.trim();
  } else if (typeof payload.command === 'string') {
    toolName = payload.command.trim();
  }

  if (!toolName) {
    return null;
  }

  const tool = toolName as TimelineTool;
  const allowedTools: TimelineTool[] = [
    'set_treatment',
    'set_month',
    'play_timeline',
    'pause_timeline',
    'focus_organ',
  ];
  if (!allowedTools.includes(tool)) {
    return null;
  }

  const rawArguments =
    asObject(payload.arguments) ??
    (payload.command
      ? Object.fromEntries(
          Object.entries(payload).filter(([key]) => key !== 'command')
        )
      : {});

  return {
    tool,
    arguments: rawArguments,
  };
}

function parseInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return null;
  }
  return value;
}

function parseNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export function applyTimelineCommand(
  rawCommand: unknown,
  context: TimelineCommandContext
): TimelineCommandResult {
  const parsed = parseCommandPayload(rawCommand);
  if (!parsed) {
    return { ok: false, message: 'Unsupported timeline command payload.' };
  }

  const monthMin = Math.min(context.monthMin, context.monthMax);
  const monthMax = Math.max(context.monthMin, context.monthMax);
  const organLookup = new Map(
    context.organOptions.map((option) => [option.key.toUpperCase(), option])
  );

  if (parsed.tool === 'set_treatment') {
    const treatmentRaw = parsed.arguments.treatment;
    if (typeof treatmentRaw !== 'string') {
      return { ok: false, message: "Field 'treatment' must be a string." };
    }

    const treatmentId = treatmentRaw.trim().toUpperCase() as TreatmentPresetId;
    if (!TREATMENT_BY_ID.has(treatmentId)) {
      return { ok: false, message: `Unsupported treatment '${treatmentRaw}'.` };
    }

    const treatmentLabel = TREATMENT_BY_ID.get(treatmentId) ?? treatmentId;
    context.setTreatment(treatmentId);
    context.appendActionLog(`Copilot switched treatment to ${treatmentLabel}`);
    return {
      ok: true,
      appliedTool: parsed.tool,
      message: `Treatment switched to ${treatmentLabel}.`,
    };
  }

  if (parsed.tool === 'set_month') {
    const monthValue = parseInteger(parsed.arguments.month);
    if (monthValue === null) {
      return { ok: false, message: "Field 'month' must be an integer." };
    }

    const clampedMonth = Math.min(Math.max(monthValue, monthMin), monthMax);
    context.setMonth(clampedMonth);
    context.appendActionLog(`Copilot set month to ${clampedMonth}`);
    return {
      ok: true,
      appliedTool: parsed.tool,
      message: `Month set to ${clampedMonth}.`,
    };
  }

  if (parsed.tool === 'play_timeline') {
    const speed = parsed.arguments.speed === undefined ? 1 : parseNumber(parsed.arguments.speed);
    if (speed === null || speed < 0.1 || speed > 4) {
      return { ok: false, message: "Field 'speed' must be between 0.1 and 4.0." };
    }

    let cycleCount: number | null = null;
    if (parsed.arguments.cycle_count !== undefined) {
      const parsedCycleCount = parseInteger(parsed.arguments.cycle_count);
      if (parsedCycleCount === null || parsedCycleCount < 1 || parsedCycleCount > 100) {
        return { ok: false, message: "Field 'cycle_count' must be an integer between 1 and 100." };
      }
      cycleCount = parsedCycleCount;
    }

    context.setPlayback({ playing: true, speed, cycleCount });
    context.appendActionLog('Copilot started timeline playback');
    return {
      ok: true,
      appliedTool: parsed.tool,
      message: 'Timeline playback started.',
    };
  }

  if (parsed.tool === 'pause_timeline') {
    context.setPlayback({ playing: false });
    context.appendActionLog('Copilot paused timeline playback');
    return {
      ok: true,
      appliedTool: parsed.tool,
      message: 'Timeline playback paused.',
    };
  }

  const organRaw = parsed.arguments.organ_key;
  if (typeof organRaw !== 'string') {
    return { ok: false, message: "Field 'organ_key' must be a string." };
  }

  const matched = organLookup.get(organRaw.trim().toUpperCase());
  if (!matched) {
    return { ok: false, message: `Unknown organ key '${organRaw}'.` };
  }

  context.focusOrgan(matched.key);
  context.appendActionLog(`Copilot focused ${matched.label}`);
  return {
    ok: true,
    appliedTool: parsed.tool,
    message: `Focused ${matched.label}.`,
  };
}
