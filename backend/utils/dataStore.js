// utils/dataStore.js
import fs from "fs";
import path from "path";
import os from "os";

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readJSON(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error("readJSON error for", filePath, err);
    return defaultValue;
  }
}

// atomic write: write to temp then rename
export function writeJSONAtomic(filePath, data) {
  try {
    ensureDirForFile(filePath);
    const tmpPath = path.join(os.tmpdir(), `tmp-${Date.now()}-${path.basename(filePath)}`);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.error("writeJSONAtomic error for", filePath, err);
    throw err;
  }
}
