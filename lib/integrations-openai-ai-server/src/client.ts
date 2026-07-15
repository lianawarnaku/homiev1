import OpenAI from "openai";

// Lazily initialized so the server can start without the key; the key is
// only required when an AI endpoint is actually called.
let _client: OpenAI | null = null;

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    if (!_client) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "OPENAI_API_KEY must be set. Add your OpenAI API key as a Replit Secret named OPENAI_API_KEY.",
        );
      }
      _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    const value = (_client as any)[prop];
    return typeof value === "function" ? value.bind(_client) : value;
  },
});
