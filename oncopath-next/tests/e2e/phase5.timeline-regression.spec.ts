import { expect, test, type Page } from '@playwright/test';

const TIMELINE_MONTH_MAX = 24;
const consoleErrorsByPage = new WeakMap<Page, string[]>();
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const EXPECTED_CONSOLE_ERROR_PATTERNS = [
  /webpack-hmr.*ERR_INVALID_HTTP_RESPONSE/i,
  /status of 503 \(Service Unavailable\)/i,
];

const DECAY_BY_TREATMENT: Record<string, number> = {
  CHEMOTHERAPY: 0.08,
  IMMUNOTHERAPY: 0.06,
  TARGETED_THERAPY: 0.1,
  RADIATION: 0.05,
  OBSERVATION: 0.02,
};

function clampRisk(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function buildTimeline({
  baselineRisk,
  treatment,
  months,
}: {
  baselineRisk: number;
  treatment: string;
  months: number;
}) {
  const normalizedTreatment = treatment.toUpperCase();
  const decay = DECAY_BY_TREATMENT[normalizedTreatment] ?? DECAY_BY_TREATMENT.CHEMOTHERAPY;
  const floorRisk = normalizedTreatment === 'OBSERVATION' ? 0.12 : 0.03;
  const horizon = Math.max(1, Math.floor(months));

  return Array.from({ length: horizon + 1 }, (_, month) => {
    const trend = floorRisk + (baselineRisk - floorRisk) * Math.exp(-decay * month);
    const oscillation = month === 0 ? 0 : Math.sin(month * 0.35 + decay * 7) * 0.005;
    return {
      month,
      risk: Number(clampRisk(trend + oscillation).toFixed(4)),
    };
  });
}

async function mockBackend(page: Page) {
  await page.route('**/simulate', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({
        simulated_risks: {
          DMETS_DX_LIVER: 0.64,
          DMETS_DX_LUNG: 0.46,
          DMETS_DX_BONE: 0.33,
        },
      }),
    });
  });

  await page.route('**/predict/timeline', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const payload = route.request().postDataJSON() as {
      baseline_risk?: number;
      treatment?: string;
      months?: number;
    };
    const baselineRisk = clampRisk(payload.baseline_risk ?? 0.5);
    const treatment = (payload.treatment ?? 'CHEMOTHERAPY').toUpperCase();
    const months = payload.months ?? TIMELINE_MONTH_MAX;
    const timeline = buildTimeline({ baselineRisk, treatment, months });

    await new Promise((resolve) => setTimeout(resolve, 320));
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        treatment,
        timeline,
      }),
    });
  });

  await page.route('**/assistant/timeline-explain', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    const payload = route.request().postDataJSON() as {
      selected_organ?: string;
      treatment?: string;
      timeline_points?: Array<{ month?: number; risk?: number }>;
      active_month?: number;
    };
    const activeMonth = payload.active_month ?? 0;
    const treatment = (payload.treatment ?? 'CHEMOTHERAPY').toUpperCase();

    await new Promise((resolve) => setTimeout(resolve, 650));
    if (activeMonth === 11 || treatment === 'OBSERVATION') {
      await route.fulfill({
        status: 503,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'assistant unavailable' }),
      });
      return;
    }

    const point = payload.timeline_points?.find((item) => item.month === activeMonth);
    const riskPercent = typeof point?.risk === 'number' ? Math.round(point.risk * 100) : null;
    await route.fulfill({
      status: 200,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: JSON.stringify({
        plain_explanation: `${payload.selected_organ ?? 'Selected organ'} at month ${activeMonth} with ${treatment} is projected around ${
          riskPercent ?? 'N/A'
        }% risk in this simulation.`,
        next_step_suggestion: `Review month ${Math.min(activeMonth + 2, TIMELINE_MONTH_MAX)} to compare trend direction.`,
        safety_note: 'This is not medical advice.',
      }),
    });
  });
}

async function gotoViewer(page: Page) {
  await page.goto('/viewer');
}

async function openTimelineDrawer(page: Page) {
  await page.getByRole('button', { name: /^Timeline$/ }).click();
  await expect(page.getByText('Timeline Controls')).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId('timeline-organ-select').evaluate((element) => (element as HTMLSelectElement).options.length)
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.getByTestId('timeline-organ-select').evaluate((element) => (element as HTMLSelectElement).value)
    )
    .not.toBe('');
}

async function setMonth(page: Page, month: number) {
  await page.getByTestId('timeline-month-slider').evaluate((element, targetMonth) => {
    const input = element as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setValue?.call(input, String(targetMonth));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, month);
  await expect(page.getByTestId('timeline-current-month')).toHaveText(String(month));
}

async function applyBridgeCommand(page: Page, command: unknown) {
  return page.evaluate((payload) => {
    const bridge = (
      window as Window & {
        __oncopathTimelineBridge?: { applyCommand: (commandBody: unknown) => unknown };
      }
    ).__oncopathTimelineBridge;
    if (!bridge) {
      throw new Error('Timeline bridge unavailable');
    }
    return bridge.applyCommand(payload);
  }, command);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  consoleErrorsByPage.set(page, errors);
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  await mockBackend(page);
});

test.afterEach(async ({ page }) => {
  const errors = (consoleErrorsByPage.get(page) ?? []).filter(
    (entry) => !EXPECTED_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(entry))
  );
  expect(errors, errors.length ? `Unexpected browser console errors:\n${errors.join('\n')}` : '').toEqual([]);
});

test('organ selection updates timeline/chart context', async ({ page }) => {
  await gotoViewer(page);
  await openTimelineDrawer(page);

  await page.getByTestId('timeline-organ-select').selectOption('DMETS_DX_LUNG');

  await expect(page.getByTestId('timeline-chart-organ-label')).toContainText('Lung');
  await expect(page.getByTestId('timeline-assistant-context')).toContainText('Lung');
  await expect(page.getByTestId('timeline-current-month')).toHaveText('0');
});

test('treatment change updates immediate local projection then live backend source', async ({ page }) => {
  await gotoViewer(page);
  await openTimelineDrawer(page);
  await setMonth(page, 8);

  await expect(page.getByTestId('timeline-projection-sentence')).toContainText('Chemotherapy');

  await page.getByTestId('timeline-treatment-select').selectOption('RADIATION');

  await expect(page.getByTestId('timeline-source-label')).toContainText('Fetching live projection');
  await expect(page.getByTestId('timeline-projection-sentence')).toContainText('Radiation');
  await expect(page.getByTestId('timeline-source-label')).toContainText('Live projection (backend)');
});

test('month slider updates playhead and explanation text', async ({ page }) => {
  await gotoViewer(page);
  await openTimelineDrawer(page);
  await setMonth(page, 6);

  await expect(page.getByTestId('timeline-projection-sentence')).toContainText('month 6');
  await expect(page.getByTestId('timeline-assistant-context')).toContainText('M6');
  await expect(page.getByTestId('timeline-assistant-plain')).toContainText('month 6');
});

test('macro and micro mode switching updates micro indicators', async ({ page }) => {
  await gotoViewer(page);

  await page.getByTestId('micro-mode-button').click();
  await expect(page.getByTestId('micro-mode-button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('micro-scene-legend')).toBeVisible();
  await expect(page.getByTestId('micro-risk-indicator')).toHaveText(/\d+%/);
  await expect(page.getByTestId('micro-tumor-scale-indicator')).toHaveText(/\d+\.\d+x/);
  await expect(page.getByTestId('micro-flow-indicator')).toContainText('·');

  await page.getByTestId('macro-mode-button').click();
  await expect(page.getByTestId('micro-scene-legend')).toBeHidden();
});

test('assistant panel refreshes and uses fallback when backend explain fails', async ({ page }) => {
  await gotoViewer(page);
  await openTimelineDrawer(page);
  await setMonth(page, 3);

  await expect(page.getByTestId('timeline-assistant-plain')).toContainText('month 3');

  await setMonth(page, 11);
  await expect(page.getByText('Refreshing…')).toBeVisible();
  await expect(page.getByText('Fallback guidance')).toBeVisible();
  await expect(page.getByText('Assistant API unavailable. Showing deterministic local guidance.')).toBeVisible();
  await expect(page.getByTestId('timeline-assistant-plain')).toContainText(
    'Assistant service is temporarily unavailable'
  );
});

test('MCP command bridge actions update controls and action log', async ({ page }) => {
  await gotoViewer(page);
  await openTimelineDrawer(page);

  await expect
    .poll(() =>
      page.evaluate(() => {
        return typeof (window as Window & { __oncopathTimelineBridge?: { applyCommand: unknown } })
          .__oncopathTimelineBridge?.applyCommand;
      })
    )
    .toBe('function');

  expect(
    await applyBridgeCommand(page, {
      tool: 'set_month',
      arguments: { month: 9 },
    })
  ).toMatchObject({ ok: true, appliedTool: 'set_month' });
  await expect(page.getByTestId('timeline-current-month')).toHaveText('9');

  expect(
    await applyBridgeCommand(page, {
      tool: 'set_treatment',
      arguments: { treatment: 'IMMUNOTHERAPY' },
    })
  ).toMatchObject({ ok: true, appliedTool: 'set_treatment' });
  await expect(page.getByTestId('timeline-treatment-select')).toHaveValue('IMMUNOTHERAPY');

  expect(await applyBridgeCommand(page, { tool: 'play_timeline', arguments: { speed: 1.2 } })).toMatchObject({
    ok: true,
    appliedTool: 'play_timeline',
  });
  await expect(page.getByText('Autoplay is running across months.')).toBeVisible();

  expect(await applyBridgeCommand(page, { tool: 'pause_timeline', arguments: {} })).toMatchObject({
    ok: true,
    appliedTool: 'pause_timeline',
  });
  await expect(page.getByText('Autoplay paused.')).toBeVisible();

  expect(
    await applyBridgeCommand(page, {
      tool: 'focus_organ',
      arguments: { organ_key: 'DMETS_DX_BONE' },
    })
  ).toMatchObject({ ok: true, appliedTool: 'focus_organ' });
  await expect(page.getByTestId('timeline-organ-select')).toHaveValue('DMETS_DX_BONE');

  const actionLog = page.getByTestId('timeline-action-log');
  await expect(actionLog).toContainText('Copilot set month to 9');
  await expect(actionLog).toContainText('Copilot switched treatment to Immunotherapy');
  await expect(actionLog).toContainText('Copilot started timeline playback');
  await expect(actionLog).toContainText('Copilot paused timeline playback');
  await expect(actionLog).toContainText('Copilot focused Bone');
});
