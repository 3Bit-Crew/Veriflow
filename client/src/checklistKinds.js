// Checklist item kinds from PLAN.md 5.3: how to show them, and the rules the server applies
// when the buyer approves (findChecklistProblems in server/src/ai/checklistRules.js).

export const MAX_ITEMS = 8;

export const KIND_LABELS = {
  tests_pass: 'Tests pass',
  files_changed: 'Files changed',
  page_loads: 'Page loads',
  element_exists: 'Element exists',
  text_present: 'Text present',
  visual: 'Visual check (AI)',
  speed_score: 'Speed score',
};

// One plain sentence saying what the checker will actually test.
export function describeParams({ kind, params = {} }) {
  switch (kind) {
    case 'tests_pass':
      return 'Every GitHub Actions check on the pull request must pass';
    case 'files_changed': {
      const parts = [];
      if (params.mustTouch?.length) parts.push(`Must change ${params.mustTouch.join(', ')}`);
      if (params.mustNotTouch?.length) parts.push(`Must not change ${params.mustNotTouch.join(', ')}`);
      return parts.join(' · ');
    }
    case 'page_loads':
      return `Page ${params.path || '/'} loads with status 200`;
    case 'element_exists':
      return `Page has an element matching ${params.selector}`;
    case 'text_present':
      return `Page shows the text "${params.text}"`;
    case 'visual':
      return `AI judges a ${params.viewport || 'mobile'} screenshot`;
    case 'speed_score':
      return `PageSpeed score of at least ${params.min}`;
    default:
      return '';
  }
}

// Returns the reasons a checklist can't be approved yet. An empty list means it's valid.
export function checklistProblems(type, items) {
  if (items.length === 0) return ['The checklist needs at least one item.'];

  const problems = [];
  if (items.length > MAX_ITEMS) problems.push(`Keep it to ${MAX_ITEMS} items or fewer.`);
  items.forEach((item, index) => {
    if (!item.text.trim()) problems.push(`Item ${index + 1} needs a description.`);
    if (!Number.isInteger(item.weight) || item.weight < 1 || item.weight > 100) {
      problems.push(`Item ${index + 1}: weight must be a whole number from 1 to 100.`);
    }
  });

  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);
  if (total !== 100) problems.push(`Weights add up to ${total}. They must add up to exactly 100.`);

  if (type === 'code' && items.filter((item) => item.kind === 'tests_pass').length !== 1) {
    problems.push('Code jobs need exactly one "Tests pass" item.');
  }
  return problems;
}
