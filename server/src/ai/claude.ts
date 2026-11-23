import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PYP_THEMES, UnitSchema, type Unit } from "@yav/shared";
import type { DB } from "../db/db.js";
import { getSetting } from "../db/settings.js";
import { config } from "../config.js";
import { STYLE_GUIDE } from "./styleGuide.js";
import { costAud, underCap } from "./spend.js";
import { qualityProblems } from "./readability.js";
import type { UnitPlan } from "../engine/picker.js";

/**
 * Claude writes new units for his next chapters. Text only: his first name and a
 * learning summary, never photos, voice or video. Every unit is checked by the schema
 * and the quality checks before it can reach him.
 */

export type GenerationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export type UnitModel = (system: string, user: string) => Promise<{ output: unknown; refused: boolean; inputTokens: number; outputTokens: number; model: string }>;

let client: Anthropic | null = null;

/** The real call: structured output, medium effort, server-side fallback if the model declines. */
export function claudeUnitModel(db: DB): UnitModel | null {
  if (!config.anthropicKey) return null;
  client ??= new Anthropic({ apiKey: config.anthropicKey });
  const anthropic = client;
  return async (system, user) => {
    const res = await anthropic.beta.messages.parse({
      model: getSetting(db, "claudeModel"),
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(UnitSchema) },
      system: [{ type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    return {
      output: res.stop_reason === "refusal" ? null : res.parsed_output,
      refused: res.stop_reason === "refusal",
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      model: res.model,
    };
  };
}

export function unitPrompt(firstName: string, plan: UnitPlan, learner: string, writing: "sentences" | "story-mountain" = "story-mountain"): string {
  return [
    `Write one learning unit for ${firstName}, for the next chapter of his journey.`,
    "",
    learner,
    "",
    `Theme: ${plan.theme}. Focus strand (most questions): ${plan.focusStrand}. Stretch strand (one harder item): ${plan.challengeStrand}.`,
    plan.reviewSkills.length ? `Also practise: ${plan.reviewSkills.join(", ")}.` : "",
    plan.pinnedSkills.length ? `His parent asked for more of: ${plan.pinnedSkills.join(", ")}.` : "",
    "",
    "Format (it must follow the schema exactly):",
    `- source "claude", theme "${plan.theme}", a short title, and an "inquiry" block: pypTheme (one of: ${PYP_THEMES.join("; ")}), a one-sentence centralIdea, 1 to 2 keyConcepts, a learnerProfile attribute, a tuneIn question about his own life, and a reflect question.`,
    "- passage: a story of 80 to 150 words in 3 or 4 paragraphs separated by a blank line, sentences of about 8 to 12 words, with 2 to 4 slightly stretching glossary words that appear in the story.",
    "- vocab: 3 word-meaning items for words in the story, each with 3 options.",
    "- questions: 5 to 7 items. Mostly short-answer with match \"keyword\", accept words that appear in the paragraph given by para (0-based), a model answer and a hint pointing to that paragraph. Include one multiple-choice inference question and one open question.",
    "- gapFill: 4 or 5 sentences using story words, each with ___ and its answer, plus 2 decoys.",
    "- corner: 2 maths word problems from the story with an arithmetic expression, unit and working, and 1 open inquiry question.",
    writing === "story-mountain"
      ? "- writing: a story-mountain task (format \"story-mountain\", mode \"print\", sentences 3, no starters) asking him to plan his own story on the same idea."
      : "- writing: a short task (format \"sentences\", mode \"print\", sentences 2) linked to the story, with 2 sentence starters. He dislikes writing, so keep it small and fun.",
    "Give every id a short unique slug.",
  ].filter((l) => l !== null).join("\n");
}

export async function generateUnit(db: DB, model: UnitModel | null, firstName: string, plan: UnitPlan, learner: string, writing: "sentences" | "story-mountain" = "story-mountain"): Promise<GenerationResult<Unit>> {
  if (!model) return { ok: false, reason: "no-api-key" };
  if (!underCap(db)) return { ok: false, reason: "monthly-cap-reached" };

  const prompt = unitPrompt(firstName, plan, learner, writing);
  const log = db.prepare(
    `INSERT INTO generation_log (purpose, model, prompt, output, valid, error, input_tokens, output_tokens, cost_aud)
     VALUES ('unit', ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  try {
    const r = await model(STYLE_GUIDE, prompt);
    const cost = costAud(db, r.model, r.inputTokens, r.outputTokens);
    if (r.refused || !r.output) {
      log.run(r.model, prompt, null, 0, r.refused ? "refusal" : "no output", r.inputTokens, r.outputTokens, cost);
      return { ok: false, reason: "refusal" };
    }
    // Refinements (word counts, index ranges) are not expressible in JSON Schema, so check again here.
    const checked = UnitSchema.safeParse({ ...(r.output as object), source: "claude" });
    const output = JSON.stringify(r.output);
    if (!checked.success) {
      log.run(r.model, prompt, output, 0, checked.error.message, r.inputTokens, r.outputTokens, cost);
      return { ok: false, reason: "invalid" };
    }
    const problems = qualityProblems(checked.data);
    if (problems.length) {
      log.run(r.model, prompt, output, 0, problems.join("; "), r.inputTokens, r.outputTokens, cost);
      return { ok: false, reason: "quality" };
    }
    log.run(r.model, prompt, output, 1, null, r.inputTokens, r.outputTokens, cost);
    return { ok: true, value: checked.data };
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? `API ${err.status}: ${err.message}` : String(err);
    log.run(getSetting(db, "claudeModel"), prompt, null, 0, message, 0, 0, 0);
    return { ok: false, reason: "api-error" };
  }
}
