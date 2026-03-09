import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getLesson, updateLesson, deleteLesson } from "../controllers/lessonController";

const lessons = new Hono<{ Bindings: Bindings }>();

lessons.get("/:id", getLesson);
lessons.put("/:id", updateLesson);
lessons.delete("/:id", deleteLesson);

export default lessons;
