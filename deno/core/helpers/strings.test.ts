import { assertEquals } from '@std/assert/equals';
import { camelCase } from "./strings.ts";
import { parseModuleName } from "./parseModuleName.ts";

Deno.test("camelCase removes trailing non-alphanumeric characters", () => {
  const camelCased = camelCase("/products/{id}");

  assertEquals(camelCased, "productsId");
});

Deno.test("camelCase capitalises first letter of complex string when upperFirst is true", () => {
  const camelCased = camelCase("/products/{id}/items/{itemId}", {
    upperFirst: true,
  });

  assertEquals(camelCased, "ProductsIdItemsItemId");
});

Deno.test("camelCase capitalises first letter of simple string when upperFirst is true", () => {
  const camelCased = camelCase("products", { upperFirst: true });

  assertEquals(camelCased, "Products");
});

Deno.test("parseModuleName parses JSR module with scheme, scope, name and version", () => {
  const parsed = parseModuleName("jsr:apiture/generator@0.1.0");

  assertEquals(parsed, {
    scheme: "jsr",
    scopeName: "apiture",
    packageName: "generator",
    version: "0.1.0",
  });
});

Deno.test("parseModuleName parses simple module name without scheme or scope", () => {
  const parsed = parseModuleName("ts-pattern");

  assertEquals(parsed, {
    scheme: null,
    scopeName: null,
    packageName: "ts-pattern",
    version: null,
  });
});

Deno.test("parseModuleName parses scoped npm module", () => {
  const parsed = parseModuleName("@types/node");

  assertEquals(parsed, {
    scheme: null,
    scopeName: "@types",
    packageName: "node",
    version: null,
  });
});

Deno.test("parseModuleName parses module with version but no scope", () => {
  const parsed = parseModuleName("react@18.2.0");

  assertEquals(parsed, {
    scheme: null,
    scopeName: null,
    packageName: "react",
    version: "18.2.0",
  });
});

Deno.test("parseModuleName parses npm scheme with scoped package and version", () => {
  const parsed = parseModuleName("npm:@babel/core@7.23.0");

  assertEquals(parsed, {
    scheme: "npm",
    scopeName: "@babel",
    packageName: "core",
    version: "7.23.0",
  });
});
