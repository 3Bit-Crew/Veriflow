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
  interaction: 'Interaction (AI)',
  lighthouse_score: 'Lighthouse score',
  source_delivered: 'Source code',
};

// Icon for each kind (names from components/ui.jsx), shown before an item is checked.
export const KIND_ICONS = {
  tests_pass: 'code',
  files_changed: 'file',
  page_loads: 'globe',
  element_exists: 'cursor',
  text_present: 'text',
  visual: 'eye',
  speed_score: 'gauge',
  interaction: 'cursor',
  lighthouse_score: 'gauge',
  source_delivered: 'code',
};

// Lighthouse category ids (PLAN.md 13.2) as a person would write them.
const LIGHTHOUSE_NAMES = { accessibility: 'accessibility', 'best-practices': 'best practices', seo: 'SEO' };

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
    case 'interaction':
      // The AI uses the site (types, clicks) on this screen size, then judges what happened.
      return `AI will, on ${params.viewport === 'mobile' ? 'mobile' : 'desktop'}: ${params.steps}`;
    case 'lighthouse_score':
      // Google Lighthouse accessibility, best-practices or SEO score, from the same PageSpeed call (PLAN.md 13.2).
      return `Lighthouse ${LIGHTHOUSE_NAMES[params.category] || params.category} score of at least ${params.min}`;
    case 'source_delivered':
      // Website jobs (PLAN.md 13.5): open or merged, in the job's repo, changing at least one file.
      return "The site's source code must be a pull request in the job's GitHub repo";
    default:
      return '';
  }
}

// Website jobs with a repo deliver their source code there, so their checklist must keep the
// automatic "Source code" item (PLAN.md 13.5). Jobs made before the change have no repo.
export const needsSourceItem = (job) => job.type === 'website' && Boolean(job.repoUrl);

// Returns the reasons a checklist can't be approved yet. An empty list means it's valid.
// needsSource: the job is a website job with a repo (needsSourceItem).
export function checklistProblems(type, items, { needsSource = false } = {}) {
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
  if (needsSource && items.filter((item) => item.kind === 'source_delivered').length !== 1) {
    problems.push('Website jobs need exactly one "Source code" item.');
  }
  return problems;
}
