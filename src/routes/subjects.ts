import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getSubjects } from "../controllers/subject.controller";
import { getCourses, createCourse, importCourses } from "../controllers/course.controller";

const subjects = new Hono<{ Bindings: Bindings }>();

subjects.get("/", getSubjects);
subjects.get("/:subjectId/courses", getCourses);
subjects.post("/:subjectId/courses", createCourse);
subjects.post("/:subjectId/import", importCourses);

export default subjects;
