import { zipSync, strToU8 } from "fflate";
import { jsPDF } from "jspdf";

function xml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function dateLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function time(value) {
  const [rawHours, rawMinutes] = String(value ?? "").slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(rawHours)) return "";
  const hours = Math.max(0, Math.min(23, rawHours));
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function timeRange(start, end) {
  return `${time(start)} - ${time(end)}`;
}

function dateTimeLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function worksheetXml(rows) {
  const body = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((cell, columnIndex) => {
            const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
            return `<c r="${ref}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

function columnName(index) {
  let name = "";
  let value = index + 1;
  while (value > 0) {
    const modulo = (value - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    value = Math.floor((value - modulo) / 26);
  }
  return name;
}

function makeWorkbook(rows) {
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(worksheetXml(rows)),
  };

  return new Blob([zipSync(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function cleanFileName(value) {
  return text(value || "buildcore-export").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
}

function addWrapped(doc, value, x, y, width, lineHeight = 14) {
  const lines = doc.splitTextToSize(text(value) || "-", width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addSection(doc, title, y) {
  if (y > 700) {
    doc.addPage();
    y = 48;
  }
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(36, y - 18, 540, 30, 7, 7, "F");
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, 50, y);
  return y + 28;
}

async function maybeAddPhoto(doc, file, y) {
  if (!file.viewUrl || file.file_kind !== "photo") return y;
  try {
    const response = await fetch(file.viewUrl);
    if (!response.ok) return y;
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    if (y > 560) {
      doc.addPage();
      y = 48;
    }
    const format = String(blob.type).includes("png") ? "PNG" : "JPEG";
    doc.addImage(dataUrl, format, 48, y, 180, 120, undefined, "FAST");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(text(file.file_name).slice(0, 48), 244, y + 16);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(text(file.photo_caption || file.file_type), 270), 244, y + 34);
    return y + 136;
  } catch {
    return y;
  }
}

function ticketRow(visit, project, people, equipment, getProfileName) {
  return [
    project?.job_number || "",
    project?.name || "",
    dateLabel(visit.visit_date),
    timeRange(visit.start_time, visit.end_time),
    visit.status || "",
    visit.work_scope || "",
    people.map((person) => person.full_name || person.email).join(", "),
    equipment.map((item) => item.name).join(", "),
    getProfileName?.(visit.assigned_by ?? visit.created_by, "") || "",
    visit.arrived_at || "",
    visit.completed_at || "",
  ];
}

export function exportProjectsXlsx(projects = [], getProfileName) {
  const rows = [
    ["Job number", "Project", "Address", "Status", "PM / Owner", "Contact", "Email", "Phone", "Description"],
    ...projects.map((project) => [
      project.job_number || "",
      project.name || "",
      project.address || "",
      project.status || "",
      getProfileName?.(project.manager_id ?? project.created_by, "") || "",
      project.contact_name || "",
      project.contact_email || "",
      project.contact_phone || "",
      project.description || "",
    ]),
  ];
  downloadBlob(makeWorkbook(rows), "buildcore-projects.xlsx");
}

export function exportProjectTicketsXlsx({ project, visits = [], people = [], equipment = [], getProfileName }) {
  const rows = [
    ["Job number", "Project", "Date", "Scheduled time", "Status", "Work scope", "People", "Equipment", "Assigned by", "Actual start", "Actual finish"],
    ...visits.map((visit) =>
      ticketRow(
        visit,
        project,
        people.filter((person) => visit.people_ids?.includes(person.id)),
        equipment.filter((item) => visit.equipment_ids?.includes(item.id)),
        getProfileName,
      ),
    ),
  ];
  downloadBlob(makeWorkbook(rows), `${cleanFileName(project?.job_number || project?.name)}-tickets.xlsx`);
}

export async function exportVisitPdf({ visit, project, people = [], equipment = [], files = [], activities = [], getProfileName }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, 612, 86, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${project?.name || "Project"} Ticket`, 36, 38);
  doc.setFontSize(11);
  doc.text(`${project?.job_number || "No job number"} / ${dateLabel(visit.visit_date)}`, 36, 60);

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(11);
  let y = 124;
  y = addSection(doc, "Ticket Details", y);
  y = addWrapped(doc, `Address: ${project?.address || "-"}`, 50, y, 500);
  y = addWrapped(doc, `Scheduled: ${timeRange(visit.start_time, visit.end_time)}`, 50, y + 4, 500);
  y = addWrapped(doc, `Actual start: ${visit.arrived_at ? dateTimeLabel(visit.arrived_at) : "Not started"}`, 50, y + 4, 500);
  y = addWrapped(doc, `Actual finish: ${visit.completed_at ? dateTimeLabel(visit.completed_at) : "Not finished"}`, 50, y + 4, 500);
  y = addWrapped(doc, `Assigned by: ${getProfileName?.(visit.assigned_by ?? visit.created_by, "Not set")}`, 50, y + 4, 500);
  y = addWrapped(doc, `People: ${people.map((person) => person.full_name || person.email).join(", ") || "-"}`, 50, y + 4, 500);
  y = addWrapped(doc, `Equipment: ${equipment.map((item) => item.name).join(", ") || "-"}`, 50, y + 4, 500);

  y = addSection(doc, "Work", y + 18);
  y = addWrapped(doc, `Project description: ${project?.description || "-"}`, 50, y, 500);
  y = addWrapped(doc, `Ticket scope: ${visit.work_scope || "-"}`, 50, y + 8, 500);

  y = addSection(doc, "Attachments", y + 18);
  for (const file of files) {
    y = addWrapped(doc, `${file.file_type || file.file_kind}: ${file.file_name}${file.photo_caption ? ` / ${file.photo_caption}` : ""}`, 50, y, 500);
    y = await maybeAddPhoto(doc, file, y + 6);
    y += 4;
  }

  y = addSection(doc, "Activity Feed", y + 18);
  for (const item of activities.slice().reverse()) {
    y = addWrapped(doc, `${dateTimeLabel(item.created_at)} / ${item.message}`, 50, y, 500);
    y += 4;
  }

  downloadBlob(doc.output("blob"), `${cleanFileName(project?.job_number || project?.name)}-${visit.visit_date}-ticket.pdf`);
}

export async function exportProjectPdf({ project, visits = [], people = [], equipment = [], files = [], activities = [], getProfileName }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, 612, 86, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text(project?.name || "Project", 36, 38);
  doc.setFontSize(11);
  doc.text(`${project?.job_number || "No job number"} / ${project?.status || "Planning"}`, 36, 60);

  doc.setTextColor(17, 24, 39);
  let y = 124;
  y = addSection(doc, "Project Details", y);
  y = addWrapped(doc, `Address: ${project?.address || "-"}`, 50, y, 500);
  y = addWrapped(doc, `PM / Owner: ${getProfileName?.(project?.manager_id ?? project?.created_by, "Not set")}`, 50, y + 4, 500);
  y = addWrapped(doc, `Contact: ${project?.contact_name || "-"} / ${project?.contact_phone || "-"} / ${project?.contact_email || "-"}`, 50, y + 4, 500);
  y = addWrapped(doc, `Description: ${project?.description || "-"}`, 50, y + 8, 500);

  y = addSection(doc, "Tickets", y + 18);
  for (const visit of visits) {
    const visitPeople = people.filter((person) => visit.people_ids?.includes(person.id));
    const visitEquipment = equipment.filter((item) => visit.equipment_ids?.includes(item.id));
    y = addWrapped(doc, `${dateLabel(visit.visit_date)} / ${timeRange(visit.start_time, visit.end_time)} / ${visit.status || ""}`, 50, y, 500);
    y = addWrapped(doc, `Scope: ${visit.work_scope || "-"}`, 62, y + 2, 486);
    y = addWrapped(doc, `People: ${visitPeople.map((person) => person.full_name || person.email).join(", ") || "-"}`, 62, y + 2, 486);
    y = addWrapped(doc, `Equipment: ${visitEquipment.map((item) => item.name).join(", ") || "-"}`, 62, y + 2, 486);
    y += 8;
  }

  y = addSection(doc, "Attachments", y + 18);
  for (const file of files) {
    y = addWrapped(doc, `${file.visit_id ? "Ticket" : "Project"} / ${file.file_type || file.file_kind}: ${file.file_name}${file.photo_caption ? ` / ${file.photo_caption}` : ""}`, 50, y, 500);
    y = await maybeAddPhoto(doc, file, y + 6);
    y += 4;
  }

  y = addSection(doc, "Activity Feed", y + 18);
  for (const item of activities.slice().reverse()) {
    y = addWrapped(doc, `${dateTimeLabel(item.created_at)} / ${item.message}`, 50, y, 500);
    y += 4;
  }

  downloadBlob(doc.output("blob"), `${cleanFileName(project?.job_number || project?.name)}-project.pdf`);
}

export async function exportFieldReportPdf({ type, record, project, files = [], creatorName = "" }) {
  const isSiteVisit = type === "siteVisit";
  const title = isSiteVisit ? "Site Visit" : "Change Order";
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFillColor(17, 24, 39);
  doc.rect(0, 0, 612, 88, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(21);
  doc.text(`${project?.name || "Project"} ${title}`, 36, 38);
  doc.setFontSize(11);
  doc.text(`${project?.job_number || "No job number"} / ${record.status || "planned"}`, 36, 62);

  doc.setTextColor(17, 24, 39);
  let y = 124;
  y = addSection(doc, `${title} Details`, y);
  y = addWrapped(doc, `Project: ${project?.name || "-"}`, 50, y, 500);
  y = addWrapped(doc, `Address: ${project?.address || "-"}`, 50, y + 4, 500);
  y = addWrapped(doc, `Date: ${dateLabel(isSiteVisit ? record.visit_date : record.order_date)}`, 50, y + 4, 500);
  y = addWrapped(doc, `Time: ${isSiteVisit ? timeRange(record.start_time, record.end_time) : time(record.order_time)}`, 50, y + 4, 500);
  y = addWrapped(doc, `Created by: ${creatorName || "-"}`, 50, y + 4, 500);
  if (!isSiteVisit) {
    y = addWrapped(doc, `Approved by: ${record.approved_by || "-"}`, 50, y + 4, 500);
  }

  y = addSection(doc, "Description", y + 18);
  y = addWrapped(doc, record.description || "-", 50, y, 500);

  if (!isSiteVisit && record.approval_signature) {
    y = addSection(doc, "Approval Signature", y + 18);
    if (y > 610) {
      doc.addPage();
      y = 48;
    }
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(48, y - 8, 260, 82, 8, 8);
    doc.addImage(record.approval_signature, "PNG", 62, y + 2, 220, 54);
    y += 100;
  }

  const groupedFiles = files.reduce((groups, file) => {
    const key = file.folder_name || "Photos";
    if (!groups.has(key)) groups.set(key, { description: file.folder_description || "", items: [] });
    const group = groups.get(key);
    if (!group.description && file.folder_description) group.description = file.folder_description;
    group.items.push(file);
    return groups;
  }, new Map());

  y = addSection(doc, "Photos and Files", y + 18);
  if (groupedFiles.size === 0) {
    y = addWrapped(doc, "No photos or files saved.", 50, y, 500);
  }
  for (const [folderName, group] of groupedFiles.entries()) {
    y = addSection(doc, folderName, y + 8);
    if (group.description) y = addWrapped(doc, group.description, 50, y, 500);
    for (const file of group.items) {
      y = addWrapped(doc, `${file.file_name}${file.photo_caption ? ` / ${file.photo_caption}` : ""}`, 50, y + 4, 500);
      y = await maybeAddPhoto(doc, file, y + 6);
    }
  }

  downloadBlob(doc.output("blob"), `${cleanFileName(project?.job_number || project?.name)}-${cleanFileName(title)}-${isSiteVisit ? record.visit_date : record.order_date}.pdf`);
}
