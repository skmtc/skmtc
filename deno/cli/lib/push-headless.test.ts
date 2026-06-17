import { assertEquals, assertStringIncludes } from "@std/assert";
import { pushHeadless } from "@/lib/push-headless.ts";
import { parseScopedName } from "@/lib/scoped-name.ts";
import type { SkmtcRoot } from "@/lib/skmtc-root.ts";

const originalFetch = globalThis.fetch;

/** Build a fake SkmtcRoot whose single project carries the given client.json. */
const makeRoot = (
  contents: Record<string, unknown>,
): {
  skmtcRoot: SkmtcRoot;
  wrote: () => boolean;
  contentsNow: () => Record<string, unknown>;
} => {
  let wrote = false;
  const clientJson = {
    contents,
    write: () => {
      wrote = true;
      return Promise.resolve();
    },
  };
  const project = { name: "my-api", clientJson };
  const skmtcRoot = { findProject: () => project } as unknown as SkmtcRoot;
  return {
    skmtcRoot,
    wrote: () => wrote,
    contentsNow: () => clientJson.contents,
  };
};

type StubArgs = {
  /** Status for GET …/config (the overwrite pre-check). */
  getStatus?: number;
  getBody?: unknown;
  /** ProjectConfig returned from PUT …/client-config. */
  putBody?: unknown;
};

const stubFetch = (
  { getStatus = 200, getBody = {}, putBody = {} }: StubArgs,
) => {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  globalThis.fetch = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body });
    if (method === "GET" && url.endsWith("/config")) {
      return Promise.resolve(
        new Response(JSON.stringify(getBody), { status: getStatus }),
      );
    }
    if (method === "PUT" && url.endsWith("/client-config")) {
      return Promise.resolve(
        new Response(JSON.stringify(putBody), { status: 200 }),
      );
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  };
  return calls;
};

Deno.test("parseScopedName - parses @account/slug", () => {
  assertEquals(parseScopedName("@acme/petstore"), {
    account: "acme",
    slug: "petstore",
  });
  assertEquals(parseScopedName("  @acme/petstore  "), {
    account: "acme",
    slug: "petstore",
  });
});

Deno.test("parseScopedName - rejects missing @, missing slug, and extra segments", () => {
  assertEquals(parseScopedName("acme/petstore"), null);
  assertEquals(parseScopedName("@acme"), null);
  assertEquals(parseScopedName("@acme/"), null);
  assertEquals(parseScopedName("@acme/a/b"), null);
});

Deno.test("pushHeadless - fails before any network call when there is no destination", async () => {
  let fetchCalls = 0;
  globalThis.fetch = () => {
    fetchCalls += 1;
    throw new Error("network must not be touched without a destination");
  };
  const { skmtcRoot } = makeRoot({ settings: { basePath: "src" } });

  try {
    const result = await pushHeadless({
      skmtcRoot,
      projectName: "my-api",
      token: "pat",
      origin: "https://hub.test",
    });
    assertEquals(result.kind, "failed");
    if (result.kind !== "failed") throw new Error("expected failed");
    assertEquals(result.stage, "destination");
    assertEquals(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("pushHeadless - PUTs the client.json settings to the resolved destination", async () => {
  const calls = stubFetch({
    getBody: {
      basePath: "src",
      packages: [],
      include: [],
      skip: [],
      enrichments: [],
    },
    putBody: {
      basePath: "src",
      packages: [],
      include: [],
      skip: [],
      enrichments: [
        {
          generator: "@x/gen-zod",
          scope: "model",
          refName: "Customer",
          variant: "main",
          values: {},
        },
      ],
    },
  });
  const { skmtcRoot } = makeRoot({
    project: "@acme/petstore",
    source: "./openapi.json",
    settings: {
      basePath: "src",
      enrichments: { "@x/gen-zod": { Customer: { main: {} } } },
    },
  });

  try {
    const result = await pushHeadless({
      skmtcRoot,
      projectName: "my-api",
      token: "pat",
      origin: "https://hub.test",
    });

    assertEquals(result.kind, "pushed");
    if (result.kind !== "pushed") throw new Error("expected pushed");
    assertEquals(result.project, { account: "acme", slug: "petstore" });
    assertEquals(result.enrichmentCount, 1);
    assertEquals(result.overwroteExistingConfig, false);
    assertEquals(result.remoteWritten, false);

    const put = calls.find((c) => c.method === "PUT");
    assertEquals(
      put?.url,
      "https://hub.test/v1/projects/acme/petstore/client-config",
    );
    const body = JSON.parse(String(put?.body));
    assertEquals(body.settings.basePath, "src");
    assertEquals(body.settings.enrichments, {
      "@x/gen-zod": { Customer: { main: {} } },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('pushHeadless - a 404 on the destination is a clear "create it first" failure', async () => {
  stubFetch({ getStatus: 404, getBody: { message: "not found" } });
  const { skmtcRoot } = makeRoot({
    project: "@acme/petstore",
    settings: { basePath: "src" },
  });

  try {
    const result = await pushHeadless({
      skmtcRoot,
      projectName: "my-api",
      token: "pat",
      origin: "https://hub.test",
    });
    assertEquals(result.kind, "failed");
    if (result.kind !== "failed") throw new Error("expected failed");
    assertEquals(result.stage, "push");
    assertStringIncludes(result.reason, "create it in the web app first");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("pushHeadless - aborts when the overwrite confirm declines", async () => {
  let putCalled = false;
  globalThis.fetch = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "PUT") putCalled = true;
    if (method === "GET" && url.endsWith("/config")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            enrichments: [{ scope: "stack", variant: "main", values: {} }],
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  const { skmtcRoot } = makeRoot({
    project: "@acme/petstore",
    settings: { basePath: "src" },
  });

  try {
    const result = await pushHeadless({
      skmtcRoot,
      projectName: "my-api",
      token: "pat",
      origin: "https://hub.test",
      confirmOverwrite: () => Promise.resolve(false),
    });
    assertEquals(result.kind, "aborted");
    assertEquals(putCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("pushHeadless - an explicit --project is written back into client.json", async () => {
  stubFetch({ getBody: {}, putBody: { enrichments: [] } });
  const { skmtcRoot, wrote, contentsNow } = makeRoot({
    settings: { basePath: "src" },
  });

  try {
    const result = await pushHeadless({
      skmtcRoot,
      projectName: "my-api",
      token: "pat",
      origin: "https://hub.test",
      projectFlag: "@org/x",
    });
    assertEquals(result.kind, "pushed");
    if (result.kind !== "pushed") throw new Error("expected pushed");
    assertEquals(result.project, { account: "org", slug: "x" });
    assertEquals(result.remoteWritten, true);
    assertEquals(wrote(), true);
    assertEquals(contentsNow().project, "@org/x");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
