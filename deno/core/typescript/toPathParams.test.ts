import { assertEquals } from "@std/assert/equals";
import { toPathParams } from "./toPathParams.ts";

Deno.test("toPathParams converts single path parameter", () => {
  const result = toPathParams("/users/{id}");
  
  assertEquals(result, "/users/:id");
});

Deno.test("toPathParams converts multiple path parameters", () => {
  const result = toPathParams("/users/{userId}/posts/{postId}");
  
  assertEquals(result, "/users/:userId/posts/:postId");
});

Deno.test("toPathParams handles path with no parameters", () => {
  const result = toPathParams("/users");
  
  assertEquals(result, "/users");
});

Deno.test("toPathParams handles empty path", () => {
  const result = toPathParams("");
  
  assertEquals(result, "");
});

Deno.test("toPathParams handles root path", () => {
  const result = toPathParams("/");
  
  assertEquals(result, "/");
});

Deno.test("toPathParams handles parameter at start of path", () => {
  const result = toPathParams("{id}/users");
  
  assertEquals(result, ":id/users");
});

Deno.test("toPathParams handles parameter at end of path", () => {
  const result = toPathParams("/users/{id}");
  
  assertEquals(result, "/users/:id");
});

Deno.test("toPathParams handles consecutive parameters", () => {
  const result = toPathParams("/api/{version}/{resource}");
  
  assertEquals(result, "/api/:version/:resource");
});

Deno.test("toPathParams handles complex parameter names", () => {
  const result = toPathParams("/users/{user_id}/posts/{post-id}");
  
  assertEquals(result, "/users/:user_id/posts/:post-id");
});

Deno.test("toPathParams handles nested path segments", () => {
  const result = toPathParams("/api/v1/users/{userId}/profiles/{profileId}/settings");
  
  assertEquals(result, "/api/v1/users/:userId/profiles/:profileId/settings");
});