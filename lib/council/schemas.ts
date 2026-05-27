import { z } from "zod"

/**
 * Wire-format Zod schemas matching the JSON each model must return.
 * If a model produces invalid output, the voice is marked failed.
 */

export const voiceSchema = z.object({
  answer: z.string().min(1),
  key_reasoning: z.string().min(1),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
})

export const labelSchema = z.enum(["A", "B", "C"])
export const confidencePostureSchema = z.enum(["firm", "hedged", "uncertain"])
export const consensusTypeSchema = z.enum(["strong", "majority", "surface"])
export const divergenceRootCauseSchema = z.enum([
  "factual",
  "framing",
  "assumption",
  "confidence",
  "genuine_uncertainty",
])
export const divergenceWeightSchema = z.enum(["high", "medium", "low"])
export const synthesisConfidenceSchema = z.enum(["high", "medium", "low"])

export const synthesisSchema = z.object({
  individual_positions: z.array(
    z.object({
      label: labelSchema,
      core_claim: z.string().min(1),
      key_reasoning: z.string().min(1),
      confidence_posture: confidencePostureSchema,
    }),
  ),
  agreement_map: z.array(
    z.object({
      claim: z.string().min(1),
      type: consensusTypeSchema,
      notes: z.string(),
    }),
  ),
  divergence_analysis: z.array(
    z.object({
      topic: z.string().min(1),
      root_cause: divergenceRootCauseSchema,
      weight: divergenceWeightSchema,
      summary: z.string().min(1),
    }),
  ),
  blind_spots: z.array(z.string()),
  recommendation: z.object({
    text: z.string().min(1),
    /**
     * When the answer is naturally a list (slate of games, steps,
     * options), the synthesizer puts items here and keeps `text` as a
     * one-line lead-in. Optional; omit for prose answers.
     */
    list_items: z.array(z.string().min(1)).optional(),
    why: z.string().min(1),
    main_caveat: z.string().min(1),
    confidence: synthesisConfidenceSchema,
  }),
})
