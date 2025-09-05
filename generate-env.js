#!/usr/bin/env node
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const out = `window.__env = {
  SUPABASE_URL: "${process.env.SUPABASE_URL}",
  SUPABASE_ANON_KEY: "${process.env.SUPABASE_ANON_KEY}"
};\n`;

fs.writeFileSync("env.js", out);
console.log("✅ env.js written");
