const searchableFields = {
  project: ["job_number", "name", "address", "contact_name", "contact_email", "contact_phone", "description"],
  person: ["full_name", "role", "trade", "phone"],
  equipment: ["name", "type", "unit_number", "status"],
  visit: ["visit_date", "start_time", "end_time", "work_scope", "office_notes", "status"],
  file: ["file_name", "search_text", "project_name"],
};

function includesQuery(value, query) {
  return String(value ?? "").toLowerCase().includes(query);
}

function makeSnippet(text, query) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  const index = clean.toLowerCase().indexOf(query);
  if (index < 0) return clean.slice(0, 150);
  return clean.slice(Math.max(0, index - 55), index + query.length + 95);
}

function collectMatches(type, rows, query) {
  return rows
    .filter((row) => searchableFields[type].some((field) => includesQuery(row[field], query)))
    .map((row) => {
      const matchedField = searchableFields[type].find((field) => includesQuery(row[field], query));
      return {
        id: `${type}-${row.id}`,
        type,
        title: row.name ?? row.full_name ?? row.file_name ?? row.visit_date,
        subtitle: row.address ?? row.trade ?? row.type ?? row.project_name ?? row.status,
        snippet: makeSnippet(row[matchedField], query),
        fileKind: row.file_kind,
      };
    });
}

export function localGlobalSearch(data, query) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return [
    ...collectMatches("project", data.projects, normalized),
    ...collectMatches("person", data.people, normalized),
    ...collectMatches("equipment", data.equipment, normalized),
    ...collectMatches("visit", data.visits, normalized),
    ...collectMatches("file", data.files ?? [], normalized),
  ].slice(0, 12);
}
