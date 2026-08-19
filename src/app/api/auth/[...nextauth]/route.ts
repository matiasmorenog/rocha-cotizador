import { handlers } from "@/lib/auth";

/** Login hits Neon + bcrypt; cold start can eat most of the default 15s budget. */
export const maxDuration = 30;

export const { GET, POST } = handlers;
