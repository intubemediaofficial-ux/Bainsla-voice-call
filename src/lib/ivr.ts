import { z } from "zod";

export const IvrDef = z.object({
  prompt: z.string().max(300).default(""),
  timeoutSec: z.number().int().min(3).max(30).default(8),
  options: z
    .array(z.object({ digit: z.string().regex(/^[0-9*#]$/), action: z.enum(["opt_out", "interested", "callback", "repeat", "hangup"]), label: z.string().max(80) }))
    .max(10),
});
export type IvrDefinition = z.infer<typeof IvrDef>;

export const IVR_ACTION_LABEL: Record<string, string> = {
  opt_out: "Opt out (never call again)",
  interested: "Mark interested",
  callback: "Request callback",
  repeat: "Repeat message",
  hangup: "Hang up",
};

/** Every flow must offer opt-out on 9. */
export function validateIvr(d: IvrDefinition): string | null {
  const digits = d.options.map((o) => o.digit);
  if (new Set(digits).size !== digits.length) return "Each key can be used only once";
  const nine = d.options.find((o) => o.digit === "9");
  if (!nine || nine.action !== "opt_out") return "Key 9 must be 'Opt out' — every call must let people stop future calls";
  return null;
}
