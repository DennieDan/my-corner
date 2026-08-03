import { z } from "zod";

const historyMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  history: z.array(historyMessageSchema).max(12).default([]),
  sessionId: z.string().trim().min(8).max(128),
}).superRefine(({ history }, context) => {
  const totalCharacters = history.reduce((total, item) => total + item.content.length, 0);
  if (totalCharacters > 12_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conversation history exceeds 12000 characters",
      path: ["history"],
    });
  }
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
