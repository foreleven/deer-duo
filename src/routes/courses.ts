import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getCourse, updateCourse, deleteCourse } from "../controllers/course.controller";
import { getChapters, createChapter, uploadChaptersFromFile } from "../controllers/chapter.controller";

const courses = new Hono<{ Bindings: Bindings }>();

courses.get("/:id", getCourse);
courses.put("/:id", updateCourse);
courses.delete("/:id", deleteCourse);
courses.get("/:courseId/chapters", getChapters);
courses.post("/:courseId/chapters/upload", uploadChaptersFromFile);
courses.post("/:courseId/chapters", createChapter);

export default courses;
