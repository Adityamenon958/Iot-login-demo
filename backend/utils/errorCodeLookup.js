const fs = require("fs");
const path = require("path");

const LOOKUP_PATH = path.join(__dirname, "..", "data", "elevatorErrorCodes.json");

let cache = null;

function loadLookup() {
  if (cache) {
    return cache;
  }

  try {
    const raw = fs.readFileSync(LOOKUP_PATH, "utf-8");
    cache = JSON.parse(raw);
  } catch (error) {
    console.error("❌ Failed to load elevator error code lookup:", error.message);
    cache = {
      "000": {
        title: "No Reported Error",
        description: "System running normally. No active fault codes."
      }
    };
  }

  return cache;
}

function normalizeCode(code) {
  if (!code && code !== 0) {
    return "000";
  }

  const stringCode = String(code).trim().toUpperCase();

  if (stringCode === "" || stringCode === "0" || stringCode === "000") {
    return "000";
  }

  // ✅ Return code as-is - no padding needed since lookup table has exact codes
  // Codes like "833", "105", "10F" are stored exactly as provided
  return stringCode;
}

function getErrorDetails(code) {
  const lookup = loadLookup();
  const normalizedCode = normalizeCode(code);
  const fallback = lookup["000"];

  if (lookup[normalizedCode]) {
    return {
      code: normalizedCode,
      ...lookup[normalizedCode]
    };
  }

  return {
    code: normalizedCode,
    title: "Unknown Error Code",
    description: "This code is not in the lookup table. Please consult the engineering handbook."
  };
}

module.exports = {
  getErrorDetails,
  normalizeCode
};

