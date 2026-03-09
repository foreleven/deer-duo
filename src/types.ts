export type User = {
  id: string | number;
  username: string;
  role: string;
};

export type Subject = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
};

export type Course = {
  id: number;
  subject_id: number;
  title: string;
  sort_order: number;
  created_at: string;
};

export type Chapter = {
  id: number;
  course_id: number;
  title: string;
  sort_order: number;
  created_at: string;
};

export type StudyRecord = {
  id: number;
  user_id: number;
  chapter_id: number;
  study_date: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
  // joined fields
  chapter_title?: string;
  course_title?: string;
  subject_name?: string;
  subject_code?: string;
  task_total?: number;
  task_done?: number;
};

export type Task = {
  id: number;
  study_record_id: number;
  task_type: "homework" | "recitation" | "preview" | "review";
  note: string | null;
  status: "pending" | "done";
  completed_at: string | null;
  created_at: string;
};

export const TASK_TYPE_LABELS: Record<Task["task_type"], string> = {
  homework: "作业",
  recitation: "背诵",
  preview: "预习",
  review: "复习",
};

export const SUBJECT_COLORS: Record<string, string> = {
  chinese: "bg-red-100 text-red-700",
  math: "bg-blue-100 text-blue-700",
  english: "bg-green-100 text-green-700",
};

