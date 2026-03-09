import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { updateCourse, deleteCourse } from "../controllers/course.controller";
import { getChapters, createChapter } from "../controllers/chapter.controller";

const courses = new Hono<{ Bindings: Bindings }>();

courses.put("/:id", updateCourse);
courses.delete("/:id", deleteCourse);
courses.get("/:courseId/chapters", getChapters);
courses.post("/:courseId/chapters", createChapter);

export default courses;
