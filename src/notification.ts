import type { CommandContext } from "./types.js";

type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastOptions {
  title?: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

/**
 * Show a toast notification in the TUI.
 */
export async function showToast(ctx: CommandContext, options: ToastOptions): Promise<void> {
  await ctx.client.tui.showToast({
    body: {
      title: options.title,
      message: options.message,
      variant: options.variant ?? "info",
      duration: options.duration,
    },
  });
}

/**
 * Sends a message that will be displayed but ignored by the AI.
 * Used for command output that shouldn't trigger AI responses.
 */
export async function sendIgnoredMessage(ctx: CommandContext, text: string): Promise<void> {
  await ctx.client.session.prompt({
    path: { id: ctx.sessionId },
    body: {
      noReply: true,
      parts: [{ type: "text", text, ignored: true }],
    },
    query: { directory: ctx.directory },
  });
}
