import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { updateChapter, deleteChapter } from "../controllers/chapterController";
import { getLessons, createLesson } from "../controllers/lessonController";

const chapters = new Hono<{ Bindings: Bindings }>();

chapters.put("/:id", updateChapter);
chapters.delete("/:id", deleteChapter);
chapters.get("/:chapterId/lessons", getLessons);
chapters.post("/:chapterId/lessons", createLesson);

export default chapters;
