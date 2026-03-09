import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { updateTask, deleteTask } from "../controllers/taskController";

const tasks = new Hono<{ Bindings: Bindings }>();

tasks.patch("/:id", updateTask);
tasks.delete("/:id", deleteTask);

export default tasks;
