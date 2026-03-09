import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getStudyRecords, createStudyRecord, deleteStudyRecord } from "../controllers/study-record.controller";
import { getTasks, createTask } from "../controllers/task.controller";
import { aiChat } from "../controllers/ai.controller";

const studyRecords = new Hono<{ Bindings: Bindings }>();

studyRecords.get("/", getStudyRecords);
studyRecords.post("/", createStudyRecord);
studyRecords.delete("/:id", deleteStudyRecord);
studyRecords.get("/:recordId/tasks", getTasks);
studyRecords.post("/:recordId/tasks", createTask);
studyRecords.post("/:recordId/ai-chat", aiChat);

export default studyRecords;
