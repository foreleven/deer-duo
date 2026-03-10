import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./lib/bindings";

import auth from "./routes/auth";
import subjects from "./routes/subjects";
import courses from "./routes/courses";
import chapters from "./routes/chapters";
import studyRecords from "./routes/studyRecords";
import tasks from "./routes/tasks";
import agents from "./routes/agents";

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  "/api/*",
  cors({
    origin: ["https://duo.process.tech"],
    credentials: true,
  }),
);

// ── API Routes ─────────────────────────────────────────────────────────────────

app.route("/api", auth);
app.route("/api/subjects", subjects);
app.route("/api/courses", courses);
app.route("/api/chapters", chapters);
app.route("/api/study-records", studyRecords);
app.route("/api/tasks", tasks);
app.route("/api/agents", agents);

// ── SPA / Asset Fallback ───────────────────────────────────────────────────────

app.get("*", async (c) => {
  // For unknown /api/* routes, return a proper 404 instead of SPA HTML
  if (c.req.path.startsWith("/api/")) {
    return c.notFound();
  }
  const response = await c.env.ASSETS.fetch(c.req.raw);

  if (response.status === 404) {
    // Only apply SPA fallback for HTML navigation requests without a file extension.
    const accept = c.req.header("Accept") ?? "";
    const isHtmlRequest = accept.includes("text/html");

    const url = new URL(c.req.url);
    const lastSegment = url.pathname.split("/").pop() ?? "";
    const hasExtension = lastSegment.includes(".");

    if (isHtmlRequest && !hasExtension) {
      // SPA fallback: serve index.html so client-side routing can handle the path
      const indexResponse = await c.env.ASSETS.fetch(
        new Request(new URL("/index.html", c.req.url)),
      );
      if (!indexResponse.ok) {
        return c.text("Not Found", 404);
      }
      return indexResponse;
    }

    // For non-HTML or asset-like requests, return the original 404 response.
    return response;
  }
  return response;
});

export default app;
