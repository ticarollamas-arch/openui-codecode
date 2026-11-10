import { createOpencodeClient } from "@opencode-ai/sdk";

export function getOpencodeClient() {
  const baseUrl = process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096";
  return createOpencodeClient({
    baseUrl,
    throwOnError: true,
    headers: process.env.OPENCODE_SERVER_PASSWORD
      ? { Authorization: `Basic ${Buffer.from(`opencode:${process.env.OPENCODE_SERVER_PASSWORD}`).toString("base64")}` }
      : undefined,
  });
}

export const opencode = {
  get health() {
    return (getOpencodeClient() as any).health;
  },
  get global() {
    return (getOpencodeClient() as any).global;
  },
  get session() {
    return (getOpencodeClient() as any).session;
  },
};
