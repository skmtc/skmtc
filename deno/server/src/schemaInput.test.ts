import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { fetchSource, SourceFetchError } from "./schemaInput.ts";

/** `fetchSource` with `globalThis.fetch` replaced, so no test touches the
 *  network — a blocked URL must fail before `fetch` is reached at all. */
const withStubbedFetch = async (
  stub: (input: URL | RequestInfo) => Response,
  body: () => Promise<void>,
) => {
  const original = globalThis.fetch;
  globalThis.fetch =
    ((input: URL | RequestInfo) =>
      Promise.resolve(stub(input))) as typeof fetch;
  try {
    await body();
  } finally {
    globalThis.fetch = original;
  }
};

/** Loopback, RFC1918, carrier-grade NAT, link-local (cloud metadata),
 *  unique-local, IPv4-mapped loopback, and private-by-convention names —
 *  in both the literal and bracketed IPv6 forms a caller can write. */
const PRIVATE_URLS = [
  "http://localhost:8080/internal/config",
  "http://127.0.0.1/x",
  "http://10.0.0.1/x",
  "http://172.16.4.4/x",
  "http://192.168.1.1/x",
  "http://100.64.0.1/x",
  "http://169.254.169.254/latest/meta-data/",
  "http://[::1]:9000/x",
  "http://[::ffff:127.0.0.1]/x",
  "http://[fd00::1]/x",
  "http://[fe80::1]/x",
  "http://build.internal/openapi.json",
  "http://printer.local/openapi.json",
];

Deno.test("fetchSource - refuses a private target without reaching fetch", async () => {
  await withStubbedFetch(
    () => {
      throw new Error("fetch must not be attempted");
    },
    async () => {
      for (const url of PRIVATE_URLS) {
        const error = await assertRejects(
          () => fetchSource(url),
          SourceFetchError,
        );
        assertStringIncludes(error.message, "private address");
      }
    },
  );
});

Deno.test("fetchSource - fetches a public target", async () => {
  await withStubbedFetch(
    () => new Response("{}", { status: 200 }),
    async () => {
      for (const url of ["https://example.com/x", "http://[2606:4700::1]/x"]) {
        const { schema } = await fetchSource(url);
        assertEquals(schema, "{}");
      }
    },
  );
});

Deno.test("fetchSource - stops after the redirect limit", async () => {
  await withStubbedFetch(
    () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/again" },
      }),
    async () => {
      const error = await assertRejects(
        () => fetchSource("https://example.com/start"),
        SourceFetchError,
      );
      assertStringIncludes(error.message, "redirects");
    },
  );
});
