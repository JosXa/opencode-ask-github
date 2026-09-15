import { Plugin } from "@opencode-ai/plugin/tui";
import { jsx } from "@opentui/solid/jsx-runtime";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { type Progress, progressEvents } from "./src/progress.js";

// Match OpenCode's native spinner frames, cadence, and semantic text color.
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export default Plugin.define({
  id: "opencode-ask-github",
  setup(ctx) {
    const [pending, setPending] = createStore<Record<string, Record<string, string>>>({});
    const unsubscribe = ctx.client.rpc(progressEvents).events.on("progress", (event) => {
      // RPC validates the payload against the shared schema before delivery.
      const { sessionID, operationID, text } = event.data as unknown as Progress;
      const next = { ...pending[sessionID] };
      if (text) next[operationID] = text;
      else delete next[operationID];
      setPending(sessionID, reconcile(next));
    });
    const unslot = ctx.ui.slot({
      append: "session.composer.top",
      render: (input) => {
        const [frame, setFrame] = createSignal(0);
        createEffect(() => {
          if (!Object.keys(pending[input.sessionID] ?? {}).length) return;
          const timer = setInterval(() => setFrame((value) => (value + 1) % frames.length), 80);
          onCleanup(() => clearInterval(timer));
        });
        return jsx("box", {
          paddingLeft: 3,
          // This slot sits below the native one-row gap between history and composer.
          get marginBottom() {
            return Object.keys(pending[input.sessionID] ?? {}).length > 0 ? 1 : 0;
          },
          get visible() {
            return Object.keys(pending[input.sessionID] ?? {}).length > 0;
          },
          get height() {
            return Object.keys(pending[input.sessionID] ?? {}).length;
          },
          get children() {
            return Object.values(pending[input.sessionID] ?? {}).map((text) =>
              jsx("text", {
                get fg() {
                  return ctx.theme.text.subdued;
                },
                get children() {
                  return `${frames[frame()]} ${text}`;
                },
              }),
            );
          },
        });
      },
    });
    return () => {
      unsubscribe();
      unslot();
    };
  },
});
