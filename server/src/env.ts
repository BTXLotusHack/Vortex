import dotenv from "dotenv";

// Load both server-local and repo-root env files without overwriting existing values.
dotenv.config();
dotenv.config({ path: "../.env", override: false });
