import type { GetRefFn, ReferenceObject, SchemaObject } from "./types.ts";
import { assertEquals } from "@std/assert/equals";
import { mergeUnion } from "./merge-union.ts";

const getRef = (ref: ReferenceObject): SchemaObject => {
  if (ref.$ref === "#/components/schemas/File") {
    return {
      oneOf: [
        {
          type: "object",
          required: ["content"],
          properties: {
            content: {
              type: "string",
            },
            encoding: {
              $ref: "#/components/schemas/Encoding",
            },
          },
        },
        {
          type: "object",
          required: ["gitSha1"],
          properties: {
            gitSha1: {
              type: "string",
            },
          },
        },
      ],
    };
  }
  if (ref.$ref === "#/components/schemas/Encoding") {
    return {
      type: "string",
      enum: ["utf-8", "base64"],
    };
  }
  if (ref.$ref === "#/components/schemas/Symlink") {
    return {
      type: "object",
      required: ["target"],
      properties: {
        target: {
          type: "string",
        },
      },
      additionalProperties: false,
    };
  }
  throw new Error(`Unknown ref: ${JSON.stringify(ref)}`);
};

const input: SchemaObject = {
  oneOf: [
    {
      allOf: [
        {
          $ref: "#/components/schemas/File",
        },
        {
          type: "object",
          required: ["kind"],
          properties: {
            kind: {
              type: "string",
              enum: ["file"],
            },
          },
        },
      ],
    },
    {
      allOf: [
        {
          $ref: "#/components/schemas/Symlink",
        },
        {
          type: "object",
          required: ["kind"],
          properties: {
            kind: {
              type: "string",
              enum: ["symlink"],
            },
          },
        },
      ],
    },
  ],
  discriminator: {
    propertyName: "kind",
  },
};

const expected: SchemaObject = {
  oneOf: [
    {
      type: "object",
      required: ["content", "kind"],
      properties: {
        content: {
          type: "string",
        },
        encoding: {
          $ref: "#/components/schemas/Encoding",
        },
        kind: {
          type: "string",
          enum: ["file"],
        },
      },
    },
    {
      type: "object",
      required: ["gitSha1", "kind"],
      properties: {
        gitSha1: {
          type: "string",
        },
        kind: {
          type: "string",
          enum: ["file"],
        },
      },
    },
    {
      type: "object",
      required: ["target", "kind"],
      properties: {
        target: {
          type: "string",
        },
        kind: {
          type: "string",
          enum: ["symlink"],
        },
      },
      additionalProperties: false,
    },
  ],
  discriminator: {
    propertyName: "kind",
  },
};

Deno.test("mergeAllOf - with top-level oneOf", () => {
  const result = mergeUnion({ schema: input, getRef, groupType: "oneOf" });

  assertEquals(result, expected);
});

Deno.test("mergeUnion - simple oneOf", () => {
  const mockGetRef: GetRefFn = () => ({});

  const input: SchemaObject = {
    oneOf: [
      {
        properties: {
          prompt: {
            description:
              "The input text prompt for the model to generate a response.",
            minLength: 1,
            type: "string",
          },
        },
        required: ["prompt"],
        title: "Prompt",
      },
      {
        properties: {
          messages: {
            description:
              "An array of message objects representing the conversation history.",
            items: {
              properties: {
                content: {
                  description: "The content of the message as a string.",
                  type: "string",
                },
                role: {
                  description:
                    "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                  type: "string",
                },
              },
              required: ["role", "content"],
              type: "object",
            },
            type: "array",
          },
        },
        required: ["messages"],
        title: "Messages",
      },
    ],
    type: "object",
  };

  const result = mergeUnion({
    schema: input,
    getRef: mockGetRef,
    groupType: "oneOf",
  });

  assertEquals(result, {
    oneOf: [
      {
        properties: {
          prompt: {
            description:
              "The input text prompt for the model to generate a response.",
            minLength: 1,
            type: "string",
          },
        },
        required: ["prompt"],
        title: "Prompt",
        type: "object",
      },
      {
        properties: {
          messages: {
            description:
              "An array of message objects representing the conversation history.",
            items: {
              properties: {
                content: {
                  description: "The content of the message as a string.",
                  type: "string",
                },
                role: {
                  description:
                    "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').",
                  type: "string",
                },
              },
              required: ["role", "content"],
              type: "object",
            },
            type: "array",
          },
        },
        required: ["messages"],
        title: "Messages",
        type: "object",
      },
    ],
  });
});

// Union-level metadata (description/title/…) must stay on the union, not be
// merged into members — merging it in would resolve the $ref members and lose
// their names. getRef throws so any resolution attempt fails the test.
Deno.test("mergeUnion - metadata stays on the union; $ref members preserved", () => {
  const failingGetRef: GetRefFn = (ref) => {
    throw new Error(`getRef must not be called — $ref must be preserved: ${ref.$ref}`);
  };

  const input: SchemaObject = {
    description: "Where a widget came from.",
    title: "WidgetSource",
    anyOf: [
      { $ref: "#/components/schemas/WidgetUrlSource" },
      { $ref: "#/components/schemas/WidgetFileSource" },
    ],
  };

  const result = mergeUnion({
    schema: input,
    getRef: failingGetRef,
    groupType: "anyOf",
  });

  assertEquals(result, {
    description: "Where a widget came from.",
    title: "WidgetSource",
    anyOf: [
      { $ref: "#/components/schemas/WidgetUrlSource" },
      { $ref: "#/components/schemas/WidgetFileSource" },
    ],
  });
});
