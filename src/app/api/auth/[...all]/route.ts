import { auth } from "@/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Mount Better Auth HTTP handler at /api/auth/* (catch-all)
export const { GET, POST } = toNextJsHandler(auth.handler);
