import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { UnitSchema, type Unit } from "@yav/shared";
import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";
import { config } from "../config.js";
import { STYLE_GUIDE } from "./styleGuide.js";
import { costAud, underCap } from "./spend.js";
import type { UnitPlan } from "../engine/picker.js";

/**
 * The only place the app talks to Claude. Text only: the child's first name
 * and learning data, never photos, voice or video.
 */

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!config.anthropicKey) return null;
  client ??= new Anthropic({ apiKey: config.anthropicKey });
  return client;
}

export type GenerationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export async function generateUnit(db: DB, firstName: string, plan: UnitPlan): Promise<GenerationResult<Unit>> {
  const anthropic = getClient();
  if (!anthropic) return { ok: false, reason: "no-api-key" };
  if (!underCap(db)) return { ok: false, reason: "monthly-cap-reached" };

  const model = getSetting(db, "claudeModel");
  const prompt = [
    `Write one learning unit for ${firstName}.`,
    `Theme: ${plan.theme}.`,
    `Focus strand (his weakest, give it the most questions): ${plan.focusStrand}.`,
    `Challenge strand (his strongest, make one question a stretch): ${plan.challengeStrand}.`,
    plan.reviewSkills.length ? `Include review of: ${plan.reviewSkills.join(", ")}.` : "",
    plan.pinnedSkills.length ? `His parent asked for more of: ${plan.pinnedSkills.join(", ")}.` : "",
    plan.avoidFormat ? `Do not open with a ${plan.avoidFormat} activity.` : "",
    `Set "source" to "claude". Give every id a short unique slug.`,
  ]
    .filter(Boolean)
    .join("\n");

  const log = db.prepare(
    `INSERT INTO generation_log (purpose, model, prompt, output, valid, error, input_tokens, output_tokens, cost_aud)
     VALUES ('unit', ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(UnitSchema) },
      system: [{ type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
    });

    const { input_tokens, output_tokens } = response.usage;
    const cost = costAud(db, model, input_tokens, output_tokens);

    if (response.stop_reason === "refusal") {
      log.run(model, prompt, null, 0, "refusal", input_tokens, output_tokens, cost);
      return { ok: false, reason: "refusal" };
    }

    // Re-validate with the full schema: refinements (word counts, index ranges) are not
    // expressible in JSON Schema, so the structured-output guarantee does not cover them.
    const checked = UnitSchema.safeParse(response.parsed_output);
    const output = JSON.stringify(response.parsed_output);
    if (!checked.success) {
      log.run(model, prompt, output, 0, checked.error.message, input_tokens, output_tokens, cost);
      return { ok: false, reason: "invalid" };
    }
    log.run(model, prompt, output, 1, null, input_tokens, output_tokens, cost);
    return { ok: true, value: checked.data };
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? `API ${err.status}: ${err.message}` : String(err);
    log.run(model, prompt, null, 0, message, 0, 0, 0);
    return { ok: false, reason: "api-error" };
  }
}
