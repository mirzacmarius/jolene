import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    /**
     * Where the studio runs; Convex Auth sends sign-in links back here.
     * Optional at push time only because a fresh deployment must push before
     * its env can be set; every deployment sets it.
     */
    SITE_URL: v.optional(v.string()),
  },
});

export default app;
