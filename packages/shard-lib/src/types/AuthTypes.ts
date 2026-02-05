/**
 * Authentication types for registry operations
 */

export type AuthInfo =
  | { type: "None" }
  | { type: "Basic"; username: string; password: string }
  | { type: "Bearer"; token: string };
