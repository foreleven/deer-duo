import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { fetchChapterContent } from "../controllers/agent.controller";

const agents = new Hono<{ Bindings: Bindings }>();

agents.post("/fetch-chapter", fetchChapterContent);

export default agents;
