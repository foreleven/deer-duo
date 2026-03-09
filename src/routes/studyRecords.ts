import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { getStudyRecords, createStudyRecord, deleteStudyRecord } from "../controllers/studyRecordController";
import { getTasks, createTask } from "../controllers/taskController";
import { aiChat } from "../controllers/aiController";

const studyRecords = new Hono<{ Bindings: Bindings }>();

studyRecords.get("/", getStudyRecords);
studyRecords.post("/", createStudyRecord);
studyRecords.delete("/:id", deleteStudyRecord);
studyRecords.get("/:recordId/tasks", getTasks);
studyRecords.post("/:recordId/tasks", createTask);
studyRecords.post("/:recordId/ai-chat", aiChat);

export default studyRecords;
