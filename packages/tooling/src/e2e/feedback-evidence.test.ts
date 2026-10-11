// packages/tooling/src/e2e/feedback-evidence.test.ts
import { feedbackEvidenceOf, feedbackFileText } from './feedback-evidence.ts';

const FLOW = 'apps/line-siege/e2e/flows/smoke/10-level-1.yaml';
const AT_EPOCH_MS = 1_790_000_000_000;

describe('feedbackEvidenceOf', () => {
  it('splits the feedback entries into sounds and haptic cues, in order', () => {
    const log = [
      { kind: 'cold-start', label: 'home', atEpochMs: AT_EPOCH_MS, data: { totalMs: 1_049 } },
      { kind: 'feedback', label: 'ui.tap', atEpochMs: AT_EPOCH_MS, data: {} },
      { kind: 'feedback', label: 'place', atEpochMs: AT_EPOCH_MS, data: {} },
      { kind: 'feedback', label: 'ui.win', atEpochMs: AT_EPOCH_MS, data: {} },
      { kind: 'feedback', label: 'success', atEpochMs: AT_EPOCH_MS, data: {} },
    ];
    expect(feedbackEvidenceOf(log, [FLOW])).toStrictEqual({
      flows: [FLOW],
      sounds: ['ui.tap', 'place', 'ui.win'],
      haptics: ['success'],
    });
  });

  it('finds nothing in a log without feedback entries or in no log at all', () => {
    expect(feedbackEvidenceOf([], [FLOW])).toStrictEqual({
      flows: [FLOW],
      sounds: [],
      haptics: [],
    });
    expect(feedbackEvidenceOf(null, [FLOW])).toStrictEqual({
      flows: [FLOW],
      sounds: [],
      haptics: [],
    });
  });

  it('ignores entries without a text label', () => {
    const log = [{ kind: 'feedback', label: 7 }, 'feedback'];
    expect(feedbackEvidenceOf(log, []).sounds).toStrictEqual([]);
  });
});

describe('feedbackFileText', () => {
  it('writes indented JSON with one trailing newline', () => {
    const text = feedbackFileText({ flows: [FLOW], sounds: ['ui.win'], haptics: ['success'] });
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toStrictEqual({
      flows: [FLOW],
      sounds: ['ui.win'],
      haptics: ['success'],
    });
  });
});
