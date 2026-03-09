import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { updateChapter, deleteChapter } from "../controllers/chapter.controller";

const chapters = new Hono<{ Bindings: Bindings }>();

chapters.put("/:id", updateChapter);
chapters.delete("/:id", deleteChapter);

export default chapters;
