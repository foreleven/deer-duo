import { Hono } from "hono";
import type { Bindings } from "../lib/bindings";
import { login, getMe, logout } from "../controllers/authController";

const auth = new Hono<{ Bindings: Bindings }>();

auth.post("/login", login);
auth.get("/me", getMe);
auth.post("/logout", logout);

export default auth;
