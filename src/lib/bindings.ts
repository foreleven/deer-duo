export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET: string | undefined;
  AI: Ai;
  ANTHROPIC_API_KEY: string | undefined;
  ANTHROPIC_BASE_URL: string | undefined;
  TAVILY_API_KEY: string | undefined;
};

export type JWTPayload = {
  sub: string;
  username: string;
  role: string;
  exp: number;
};
