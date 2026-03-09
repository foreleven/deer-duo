import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getSubjects } from "../controllers/subjectController";
import { getChapters, createChapter, importCourses } from "../controllers/chapterController";

const subjects = new Hono<{ Bindings: Bindings }>();

subjects.get("/", getSubjects);
subjects.get("/:subjectId/chapters", getChapters);
subjects.post("/:subjectId/chapters", createChapter);
subjects.post("/:subjectId/import", importCourses);

export default subjects;
