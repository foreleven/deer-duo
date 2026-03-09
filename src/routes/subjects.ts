import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getSubjects } from "../controllers/subjectController";
import { getChapters, createChapter } from "../controllers/chapterController";

const subjects = new Hono<{ Bindings: Bindings }>();

subjects.get("/", getSubjects);
subjects.get("/:subjectId/chapters", getChapters);
subjects.post("/:subjectId/chapters", createChapter);

export default subjects;
