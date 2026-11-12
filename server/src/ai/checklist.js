// generateChecklist(job): job description in, checklist items out (PLAN.md 5.3 and 5.6).
import { generateJSON } from "./index.js";
import { checklistPrompt } from "./prompts.js";
import { ALLOWED_KINDS, validateAndFixItems } from "./checklistRules.js";

/**
 * @param {{ title?: string, description: string, type: 'code'|'website', repoUrl?: string }} job
 * @returns {Promise<Array<{ text, kind, params, weight, status }>>}
 *   Items in the PLAN 5.2 shape (no _id). Weights add up to 100. Only allowed kinds.
 *   Throws if the AI fails completely (the route should answer 500 with the message).
 */
export async function generateChecklist(job) {
  if (!job || !job.description) throw new Error("Job description is required");
  if (!ALLOWED_KINDS[job.type])
    throw new Error(`Unknown job type: ${job.type}`);

  const reply = await generateJSON(checklistPrompt(job));
  const items = Array.isArray(reply) ? reply : reply?.items;
  // Website jobs with a repo get the automatic "source code delivered" item.
  return validateAndFixItems(job.type, items, { addSource: job.type === "website" && Boolean(job.repoUrl) });
}
