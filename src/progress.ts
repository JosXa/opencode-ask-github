export const progressEvents = {
  id: "opencode-ask-github",
  methods: {},
  events: {
    progress: {
      schema: {
        type: "object",
        properties: {
          sessionID: { type: "string" },
          operationID: { type: "string" },
          text: { type: "string" },
        },
        required: ["sessionID", "operationID", "text"],
        additionalProperties: false,
      },
    },
  },
} as const;

export interface Progress {
  sessionID: string;
  operationID: string;
  text: string;
}
