import type { OpenAPIV3 } from "openapi-types";
import { mergeIntersection } from "./merge-intersection.ts";
import { assertEquals } from "@std/assert/equals";
import { mergeUnion } from "./merge-union.ts";

const getRef = (ref: OpenAPIV3.ReferenceObject): OpenAPIV3.SchemaObject => {
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

Deno.test("mergeAllOf - complex oneOf", () => {
  const input: OpenAPIV3.SchemaObject = {
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
  };

  const expected: OpenAPIV3.SchemaObject = {
    oneOf: [
      {
        type: "object",
        required: ["content", "kind"],
        properties: {
          kind: {
            type: "string",
            enum: ["file"],
          },
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
        required: ["gitSha1", "kind"],
        properties: {
          kind: {
            type: "string",
            enum: ["file"],
          },
          gitSha1: {
            type: "string",
          },
        },
      },
    ],
  };

  const result = mergeIntersection({ schema: input, getRef });

  assertEquals(result, expected);
});

Deno.test("mergeAllOf - even more complex oneOf", () => {
  const input: OpenAPIV3.SchemaObject = {
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

  const expected: OpenAPIV3.SchemaObject = {
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

  const result = mergeUnion({ schema: input, getRef, groupType: "oneOf" });

  assertEquals(result, expected);
});
