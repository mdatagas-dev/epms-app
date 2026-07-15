import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { db } from "./pool.ts";

export const auth = betterAuth({
  appName: "EPMS",
  database: db,
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.ALLOW_SEED_SIGNUP !== "true",
  },
  user: {
    additionalFields: {
      role: {
        type: ["engineer", "supervisor"],
        required: true,
        defaultValue: "engineer",
        input: false,
      },
    },
  },
  plugins: [nextCookies()],
});

export type CurrentUser = typeof auth.$Infer.Session.user;
