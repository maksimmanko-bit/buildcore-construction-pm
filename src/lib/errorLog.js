import { supabase } from "./supabase.js";

const ERROR_LOG_KEY = "buildcore_error_log";
const MAX_LOCAL_ERRORS = 40;

function toPlainObject(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? {}));
  } catch {
    return { note: "Metadata could not be serialized." };
  }
}

function normalizeError(error, context = {}) {
  const isError = error instanceof Error;
  const message = isError ? error.message : typeof error === "string" ? error : error?.message || "Unknown client error";
  return {
    company_id: context.companyId || context.company_id || null,
    created_at: new Date().toISOString(),
    message,
    metadata: toPlainObject({
      ...(context.metadata ?? {}),
      errorName: isError ? error.name : error?.name,
      role: context.role,
    }),
    path: context.path || window.location.href,
    profile_id: context.profileId || context.profile_id || null,
    source: context.source || "client",
    stack: isError ? error.stack || "" : error?.stack || "",
    user_agent: navigator.userAgent,
  };
}

function saveLocalError(entry) {
  try {
    const current = JSON.parse(window.localStorage.getItem(ERROR_LOG_KEY) || "[]");
    window.localStorage.setItem(ERROR_LOG_KEY, JSON.stringify([entry, ...current].slice(0, MAX_LOCAL_ERRORS)));
  } catch {
    // Local logging is best-effort and should never break the app.
  }
}

function writeRemoteError(entry) {
  if (!supabase || !entry.company_id) return;
  supabase
    .from("client_error_logs")
    .insert(entry)
    .then(({ error }) => {
      if (error && error.code !== "42P01") {
        console.warn("BuildCore remote error logging failed:", error.message);
      }
    })
    .catch((error) => {
      console.warn("BuildCore remote error logging failed:", error?.message || error);
    });
}

export function recordClientError(error, context = {}) {
  const entry = normalizeError(error, context);
  console.error("BuildCore client error:", entry);
  saveLocalError(entry);
  writeRemoteError(entry);
  return entry;
}

export function readLocalErrorLog() {
  try {
    return JSON.parse(window.localStorage.getItem(ERROR_LOG_KEY) || "[]");
  } catch {
    return [];
  }
}
