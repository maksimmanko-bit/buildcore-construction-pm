import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleGauge,
  ClipboardCheck,
  Construction,
  Download,
  Edit3,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Forklift,
  Home,
  ImagePlus,
  Mail,
  MapPin,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  Save,
  Search,
  Settings,
  Shovel,
  CloudSun,
  Trash2,
  Tractor,
  Truck,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { overlaps } from "./lib/schedule.js";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { createAttachmentUrls, createProfileAvatarUrl, deleteVisitFile, replaceVisitPhotoWithAnnotation, uploadProfileAvatar, uploadVisitGeneratedFile, uploadVisitPhoto } from "./lib/storage.js";
import { localGlobalSearch } from "./lib/search.js";
import { getGoogleMapsUrl, getWeatherForAddress } from "./lib/weather.js";
import { readCachedWorkspace, writeCachedWorkspace } from "./lib/localCache.js";

const PhotoAnnotator = lazy(() => import("./components/PhotoAnnotator.jsx"));
const DocumentUploader = lazy(() => import("./components/DocumentUploader.jsx"));

const tradeGroups = ["Demo/Asbestos", "Drywall/Mud/Taping/Flooring", "General Construction", "Management", "Shop/Trucking"];
const unassignedTradeLabel = "Unassigned";
const equipmentAvatarOptions = [
  { key: "excavator", label: "Excavator", Icon: Tractor },
  { key: "trailer", label: "Trailer", Icon: Truck },
  { key: "truck", label: "Pickup / Truck", Icon: Truck },
  { key: "skid_steer", label: "Skid Steer", Icon: Forklift },
  { key: "lift", label: "Lift", Icon: Construction },
  { key: "concrete", label: "Concrete", Icon: Shovel },
  { key: "tools", label: "Tools", Icon: Wrench },
];

const demo = {
  companyId: "00000000-0000-0000-0000-000000000001",
  projects: [
    {
      id: "project-1",
      job_number: "BC-2401",
      name: "Riverside Building",
      address: "300 Assiniboine Ave, Winnipeg, MB",
      contact_name: "RiverView Development",
      contact_email: "office@riverview.example",
      contact_phone: "(204) 555-0188",
      project_manager: "James Carter",
      category: "Residential Construction",
      status: "In Progress",
      start_date: "Mar 1, 2024",
      end_date: "Nov 30, 2024",
      progress: 62,
      description:
        "A 12-floor residential building located in the heart of the city. The project includes high-end apartments, underground parking, and a rooftop terrace.",
    },
    {
      id: "project-2",
      job_number: "BC-2402",
      name: "Greenwood Complex",
      address: "Route 90, Winnipeg, MB",
      contact_name: "Greenwood Properties",
      contact_email: "projects@greenwood.example",
      contact_phone: "(204) 555-0134",
      project_manager: "Mason Clarke",
      category: "Commercial Construction",
      status: "Planned",
      start_date: "May 21, 2024",
      end_date: "Dec 12, 2024",
      progress: 18,
      description: "Commercial complex inspection and site preparation package.",
    },
    {
      id: "project-3",
      job_number: "BC-2403",
      name: "Lakeside Villa",
      address: "Lakeview Dr, Brandon, MB",
      contact_name: "Lakeside Homes",
      contact_email: "hello@lakeside.example",
      contact_phone: "(204) 555-0112",
      project_manager: "James Carter",
      category: "Custom Residential",
      status: "Scheduled",
      start_date: "May 10, 2024",
      end_date: "Sep 20, 2024",
      progress: 34,
      description: "Electrical rough-in, framing coordination, and fixture installation.",
    },
    {
      id: "project-4",
      job_number: "BC-2404",
      name: "Oakridge Tower",
      address: "Oakridge St, Winnipeg, MB",
      contact_name: "Oakridge Group",
      contact_email: "pm@oakridge.example",
      contact_phone: "(204) 555-0109",
      project_manager: "Lena Wolfe",
      category: "Tower Renovation",
      status: "Inspection",
      start_date: "Apr 3, 2024",
      end_date: "Oct 8, 2024",
      progress: 47,
      description: "Plumbing rough-in, exterior work, and pressure test visits.",
    },
  ],
  people: [
    { id: "person-1", full_name: "Alex Johnson", role: "builder", trade: "Management", phone: "(204) 555-0101", avatar: "AJ" },
    { id: "person-2", full_name: "Michael Smith", role: "builder", trade: "General Construction", phone: "(204) 555-0102", avatar: "MS" },
    { id: "person-3", full_name: "David Brown", role: "builder", trade: "Drywall/Mud/Taping/Flooring", phone: "(204) 555-0103", avatar: "DB" },
    { id: "person-4", full_name: "James Wilson", role: "builder", trade: "Demo/Asbestos", phone: "(204) 555-0104", avatar: "JW" },
    { id: "person-5", full_name: "Robert Taylor", role: "builder", trade: "Shop/Trucking", phone: "(204) 555-0105", avatar: "RT" },
  ],
  equipment: [
    { id: "eq-1", name: "Excavator 320", type: "Excavator", unit_number: "EX-320", icon: "excavator", avatar_key: "excavator" },
    { id: "eq-2", name: "Skid Steer S770", type: "Skid Steer", unit_number: "SS-770", icon: "loader", avatar_key: "skid_steer" },
    { id: "eq-3", name: "Pickup Truck #12", type: "Truck", unit_number: "TR-12", icon: "truck", avatar_key: "truck" },
    { id: "eq-4", name: "Boom Lift 45ft", type: "Lift", unit_number: "BL-45", icon: "lift", avatar_key: "lift" },
  ],
  files: [
    {
      id: "file-1",
      project_name: "Riverside Building",
      file_name: "Safety form - first visit.pdf",
      file_kind: "pdf",
      search_text: "Safety form ladder inspection PPE hazards first aid emergency contact Riverside Building",
    },
    {
      id: "file-2",
      project_name: "Lakeside Villa",
      file_name: "Equipment booking.xlsx",
      file_kind: "excel",
      search_text: "Mini Excavator EX-02 booked framing fixture installation material delivery",
    },
  ],
};

const navItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "people", label: "People", icon: UsersRound },
  { id: "equipment", label: "Equipment", icon: Truck },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "safetyReports", label: "Safety Reports", icon: FileBarChart2 },
  { id: "settings", label: "Settings", icon: Settings },
];

const roleOptions = ["owner", "project_manager", "office_manager", "builder"];
const projectStatusMap = {
  planning: "Planned",
  active: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};
const visitStatusMap = {
  planned: "Planned",
  on_site: "Active",
  completed: "Done",
  cancelled: "Cancelled",
};
const hazardOptions = ["Working at heights", "Excavation / trench", "Electrical hazard", "Heavy equipment", "Traffic / public access", "Weather exposure", "Dust / silica", "Manual lifting"];
const timeLabels = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM"];
const colors = ["blue", "green", "yellow", "purple", "orange"];
const scheduleStartHour = 7;
const scheduleEndHour = 22;
const defaultFeatureFlags = {
  safetyForm: true,
  beforeAfterPhotos: true,
  testBots: false,
};

function normalizeFeatureFlags(flags) {
  return { ...defaultFeatureFlags, ...(flags && typeof flags === "object" ? flags : {}) };
}

const demoAssignments = [
  { id: "a1", type: "person", resourceId: "person-1", projectId: "project-1", title: "Riverside Building", subtitle: "Site Supervision", start: 7.55, end: 12.7, color: "blue" },
  { id: "a2", type: "person", resourceId: "person-1", projectId: "project-2", title: "Greenwood Complex", subtitle: "Site Inspection", start: 13.1, end: 17.7, color: "purple" },
  { id: "a3", type: "person", resourceId: "person-2", projectId: "project-1", title: "Riverside Building", subtitle: "Framing", start: 7.55, end: 11.45, color: "green" },
  { id: "a4", type: "person", resourceId: "person-2", projectId: "project-1", title: "Riverside Building", subtitle: "Framing", start: 13.1, end: 18.2, color: "green" },
  { id: "a5", type: "person", resourceId: "person-3", projectId: "project-3", title: "Lakeside Villa", subtitle: "Electrical Rough-In", start: 7.55, end: 12.4, color: "yellow" },
  { id: "a6", type: "person", resourceId: "person-3", projectId: "project-3", title: "Lakeside Villa", subtitle: "Fixture Installation", start: 13.1, end: 18.2, color: "yellow" },
  { id: "a7", type: "person", resourceId: "person-4", projectId: "project-4", title: "Oakridge Tower", subtitle: "Plumbing Rough-In", start: 7.75, end: 12.4, color: "purple" },
  { id: "a8", type: "person", resourceId: "person-4", projectId: "project-4", title: "Oakridge Tower", subtitle: "Pressure Test", start: 13.1, end: 18.2, color: "purple" },
  { id: "a9", type: "person", resourceId: "person-5", projectId: "project-1", title: "Riverside Building", subtitle: "Excavation", start: 7.75, end: 11.55, color: "orange" },
  { id: "a10", type: "person", resourceId: "person-5", projectId: "project-3", title: "Material Delivery", subtitle: "Various Sites", start: 13.1, end: 17.0, color: "orange" },
  { id: "e1", type: "equipment", resourceId: "eq-1", projectId: "project-1", title: "Riverside Building", subtitle: "Excavation", timeText: "7:00 AM - 12:00 PM", start: 7.45, end: 12.55, color: "blue" },
  { id: "e2", type: "equipment", resourceId: "eq-1", projectId: "project-2", title: "Greenwood Complex", subtitle: "Excavation", timeText: "1:00 PM - 5:00 PM", start: 13.35, end: 18.15, color: "blue" },
  { id: "e3", type: "equipment", resourceId: "eq-2", projectId: "project-3", title: "Lakeside Villa", subtitle: "Site Preparation", timeText: "7:00 AM - 12:00 PM", start: 7.45, end: 11.6, color: "green" },
  { id: "e4", type: "equipment", resourceId: "eq-2", projectId: "project-3", title: "Lakeside Villa", subtitle: "Site Preparation", timeText: "1:00 PM - 4:00 PM", start: 13.35, end: 16.9, color: "green" },
  { id: "e5", type: "equipment", resourceId: "eq-3", projectId: "project-3", title: "Various Sites", subtitle: "Material Delivery", timeText: "7:00 AM - 5:00 PM", start: 7.45, end: 18.15, color: "yellow" },
  { id: "e6", type: "equipment", resourceId: "eq-4", projectId: "project-4", title: "Oakridge Tower", subtitle: "Exterior Work", timeText: "8:00 AM - 12:00 PM", start: 7.75, end: 11.55, color: "purple" },
  { id: "e7", type: "equipment", resourceId: "eq-4", projectId: "project-4", title: "Oakridge Tower", subtitle: "Exterior Work", timeText: "1:00 PM - 4:00 PM", start: 13.35, end: 16.9, color: "purple" },
];

const emptyProjectForm = {
  job_number: "",
  name: "",
  address: "",
  manager_id: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  description: "",
  status: "planning",
};
const emptyEquipmentForm = { name: "", type: "", unit_number: "", notes: "", avatar_key: "excavator" };
const emptyVisitForm = {
  project_id: "",
  visit_date: new Date().toISOString().slice(0, 10),
  duration_days: "1",
  start_time: "07:00",
  end_time: "17:00",
  work_scope: "",
  work_scopes: [""],
  is_first_visit: false,
  people_ids: [],
  equipment_ids: [],
};

function serializeProjectEditorForm(form) {
  return JSON.stringify({
    address: form.address ?? "",
    contact_email: form.contact_email ?? "",
    contact_name: form.contact_name ?? "",
    contact_phone: form.contact_phone ?? "",
    description: form.description ?? "",
    job_number: form.job_number ?? "",
    manager_id: form.manager_id ?? "",
    name: form.name ?? "",
    status: form.status ?? "planning",
  });
}

function serializeVisitEditorForm(form) {
  return JSON.stringify({
    duration_days: String(form.duration_days ?? "1"),
    end_time: String(form.end_time ?? "17:00").slice(0, 5),
    equipment_ids: [...(form.equipment_ids ?? [])].sort(),
    is_first_visit: Boolean(form.is_first_visit),
    people_ids: [...(form.people_ids ?? [])].sort(),
    project_id: form.project_id ?? "",
    start_time: String(form.start_time ?? "07:00").slice(0, 5),
    visit_date: form.visit_date ?? "",
    work_scope: form.work_scope ?? "",
    work_scopes: [...(form.work_scopes ?? [])],
  });
}

function escapeSvgText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getProjectPhoto(projectName) {
  const title = escapeSvgText(projectName);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#b7c9dc"/>
          <stop offset="0.55" stop-color="#eef4f7"/>
          <stop offset="1" stop-color="#79899a"/>
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#27384d"/>
          <stop offset="1" stop-color="#111827"/>
        </linearGradient>
      </defs>
      <rect width="900" height="600" rx="34" fill="url(#sky)"/>
      <path d="M0 460 C180 410 310 505 510 455 C670 416 770 470 900 435 L900 600 L0 600 Z" fill="#3f5264" opacity=".32"/>
      <g transform="translate(120 106)">
        <path d="M50 110 360 20 650 118 650 385 50 385Z" fill="#202b35"/>
        <path d="M85 128 360 55 615 135 615 352 85 352Z" fill="url(#glass)"/>
        ${Array.from({ length: 6 })
          .map((_, row) =>
            Array.from({ length: 12 })
              .map((__, col) => `<rect x="${112 + col * 39}" y="${152 + row * 30}" width="26" height="16" rx="3" fill="${(row + col) % 4 === 0 ? "#f6c46d" : "#91a9bd"}" opacity="${(row + col) % 4 === 0 ? ".95" : ".42"}"/>`)
              .join(""),
          )
          .join("")}
        <rect x="300" y="286" width="110" height="66" rx="6" fill="#dba760"/>
        <rect x="70" y="385" width="610" height="36" rx="8" fill="#141a21"/>
      </g>
      <text x="54" y="552" fill="#ffffff" font-family="Inter, Arial" font-size="38" font-weight="800">${title}</text>
    </svg>
  `)}`;
}

function roleLabel(role) {
  return {
    owner: "Owner",
    project_manager: "Project Manager",
    office_manager: "Office Manager",
    builder: "Builder",
  }[role] ?? role;
}

function profileDisplayName(person, fallback = "Not set") {
  if (!person) return fallback;
  const firstLast = `${person.first_name || ""} ${person.last_name || ""}`.trim();
  return firstLast || person.full_name || person.email || fallback;
}

function getPersonWorkStatus({ date, person, personId, projects = [], visits = [] }) {
  const resolvedPersonId = personId ?? person?.id;
  const dayVisits = visits.filter((visit) => visit.visit_date === date && visit.people_ids?.includes(resolvedPersonId) && visit.status !== "cancelled");
  const activeVisit = dayVisits.find((visit) => visit.status === "on_site");
  const plannedVisit = dayVisits.find((visit) => visit.status === "planned");
  const visit = activeVisit || plannedVisit;
  const project = visit ? projects.find((item) => item.id === visit.project_id) : null;

  if (activeVisit) return { label: "Active", tone: "active", detail: project?.name || "On site" };
  if (person?.availability_status === "not_available") return { label: "Not Available", tone: "notAvailable", detail: "Manually unavailable" };
  if (plannedVisit) return { label: "Scheduled", tone: "scheduled", detail: project?.name || "Scheduled today" };
  return { label: "Available", tone: "available", detail: "No assignment" };
}

function getEquipmentWorkStatus({ date, equipment, equipmentId, projects = [], visits = [] }) {
  const resolvedEquipmentId = equipmentId ?? equipment?.id;
  const dayVisits = visits.filter((visit) => visit.visit_date === date && visit.equipment_ids?.includes(resolvedEquipmentId) && visit.status !== "cancelled");
  const activeVisit = dayVisits.find((visit) => visit.status === "on_site");
  const plannedVisit = dayVisits.find((visit) => visit.status === "planned");
  const visit = activeVisit || plannedVisit;
  const project = visit ? projects.find((item) => item.id === visit.project_id) : null;

  if (activeVisit) return { label: "Active", tone: "active", detail: project?.name || "On site" };
  if (plannedVisit) return { label: "Scheduled", tone: "scheduled", detail: project?.name || "Scheduled today" };
  return { label: "Available", tone: "available", detail: "No assignment" };
}

function getOverlappingPersonIds({ personIds = [], targetVisit, visits = [] }) {
  if (!targetVisit || personIds.length === 0) return new Set();
  const targetStart = String(targetVisit.start_time).slice(0, 5);
  const targetEnd = String(targetVisit.end_time).slice(0, 5);

  return new Set(
    personIds.filter((personId) =>
      visits.some((visit) => {
        if (visit.id === targetVisit.id || visit.status === "cancelled") return false;
        if (visit.visit_date !== targetVisit.visit_date || !visit.people_ids?.includes(personId)) return false;
        return overlaps(targetStart, targetEnd, String(visit.start_time).slice(0, 5), String(visit.end_time).slice(0, 5));
      }),
    ),
  );
}

function getCrewGroupDropSummary({ assignment, group, visits = [] }) {
  const personIds = group?.personIds ?? [];
  const targetVisit = visits.find((visit) => visit.id === assignment?.visitId);
  const conflictIds = getOverlappingPersonIds({ personIds, targetVisit, visits });
  return {
    availableCount: Math.max(0, personIds.length - conflictIds.size),
    conflictCount: conflictIds.size,
    totalCount: group?.count ?? personIds.length,
  };
}

function toHour(time) {
  const [hours, minutes] = String(time ?? "08:00").split(":").map(Number);
  return hours + (minutes || 0) / 60;
}

function packVisitLanes(visits = []) {
  const sortedVisits = [...visits].sort((a, b) => {
    const startDiff = toHour(a.start_time) - toHour(b.start_time);
    if (startDiff !== 0) return startDiff;
    return toHour(a.end_time) - toHour(b.end_time);
  });
  const laneEnds = [];
  const laneByVisitId = new Map();

  sortedVisits.forEach((visit) => {
    const start = toHour(visit.start_time);
    const end = Math.max(start + 0.25, toHour(visit.end_time));
    const laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    const nextLaneIndex = laneIndex === -1 ? laneEnds.length : laneIndex;
    laneEnds[nextLaneIndex] = end;
    laneByVisitId.set(visit.id, nextLaneIndex);
  });

  return { laneByVisitId, laneCount: Math.max(1, laneEnds.length) };
}

function toTimeValue(hourValue) {
  const clamped = Math.max(0, Math.min(23.75, hourValue));
  const totalMinutes = Math.round(clamped * 4) * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeLabel(value) {
  const [rawHours, rawMinutes] = String(value ?? "").slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(rawHours)) return "TBD";
  const hours = Math.max(0, Math.min(23, rawHours));
  const minutes = Number.isFinite(rawMinutes) ? rawMinutes : 0;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatTimeRange(start, end) {
  return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
}

function formatDateTimeLabel(value) {
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

const timePickerOptions = Array.from({ length: 96 }, (_, index) => {
  const value = toTimeValue(index / 4);
  return { value, label: formatTimeLabel(value) };
});

function formatDateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function shiftDate(value, amount) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shiftMonth(value, amount) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function isWeekendDate(value) {
  const day = new Date(`${value}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function collectBusinessDates(startDate, count) {
  const dates = [];
  const next = new Date(`${startDate}T12:00:00`);
  const target = Math.max(1, Number(count) || 1);

  while (dates.length < target) {
    const value = next.toISOString().slice(0, 10);
    if (!isWeekendDate(value)) dates.push(value);
    next.setDate(next.getDate() + 1);
  }

  return dates;
}

function collectVisitDates(startDate, count) {
  const target = Math.max(1, Number(count) || 1);
  if (target === 1) return [startDate];
  return collectBusinessDates(startDate, target);
}

function parseWorkDayCount(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeWorkScopes(scopes, count, fallback = "") {
  const values = Array.isArray(scopes) ? scopes : [];
  return Array.from({ length: Math.max(1, count) }, (_, index) => values[index] ?? (index === 0 ? fallback : ""));
}

function fileInputKey(file) {
  return `${file?.name ?? "file"}-${file?.size ?? 0}-${file?.lastModified ?? 0}`;
}

function getWeekDates(value) {
  const date = new Date(`${value}T12:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(date);
    next.setDate(date.getDate() + index);
    return next.toISOString().slice(0, 10);
  });
}

function getMonthDates(value) {
  const date = new Date(`${value}T12:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const next = new Date(year, month, index + 1, 12);
    return next.toISOString().slice(0, 10);
  });
}

function formatMonthTitle(value) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
}

function normalizeStatus(status) {
  return projectStatusMap[status] ?? status ?? "Planned";
}

function normalizeVisitStatus(status) {
  return visitStatusMap[status] ?? status ?? "Planned";
}

function samplePhoto() {
  return getProjectPhoto("Site photo");
}

function makeInitials(name, fallback = "BC") {
  return String(name || fallback)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanSearchText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function highlightText(value, query) {
  const raw = cleanSearchText(value);
  const terms = String(query ?? "")
    .toLowerCase()
    .split(/[^a-z0-9а-яё]+/i)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  if (!raw || terms.length === 0) return raw;

  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return raw.split(pattern).map((part, index) =>
    terms.includes(part.toLowerCase()) ? (
      <mark className="searchHit" key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

function getAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Safety form header image could not be loaded.");
  const blob = await response.blob();
  return fileToDataUrl(blob);
}

async function dataUrlToFile(dataUrl, fileName, mimeType = "image/jpeg") {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: mimeType });
}

function describeVisitConflict({ candidate, visits = [], projects = [], people = [], equipment = [], editingVisitId = "" }) {
  const conflicts = [];
  const selectedPeople = new Set(candidate.people_ids ?? []);
  const selectedEquipment = new Set(candidate.equipment_ids ?? []);

  visits.forEach((visit) => {
    if (editingVisitId && visit.id === editingVisitId) return;
    if (visit.visit_date !== candidate.visit_date || visit.status === "cancelled") return;
    if (!overlaps(candidate.start_time, candidate.end_time, String(visit.start_time).slice(0, 5), String(visit.end_time).slice(0, 5))) return;

    const project = projects.find((item) => item.id === visit.project_id);
    const busyPeople = people.filter((person) => selectedPeople.has(person.id) && visit.people_ids?.includes(person.id));
    const busyEquipment = equipment.filter((item) => selectedEquipment.has(item.id) && visit.equipment_ids?.includes(item.id));

    if (busyPeople.length) {
      conflicts.push(`${busyPeople.map((person) => profileDisplayName(person)).join(", ")} already scheduled on ${project?.name || "another project"}`);
    }
    if (busyEquipment.length) {
      conflicts.push(`${busyEquipment.map((item) => item.name).join(", ")} already scheduled on ${project?.name || "another project"}`);
    }
  });

  return [...new Set(conflicts)];
}

function FormField({ label, children }) {
  return (
    <label className="formField">
      <span>{label}</span>
      {children}
    </label>
  );
}

function DateField({ label, onChange, value }) {
  const [isOpen, setIsOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(value || new Date().toISOString().slice(0, 10));
  const fieldRef = useRef(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event) {
      if (fieldRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="formField dateField" ref={fieldRef}>
      <span>{label}</span>
      <button
        className="modernDateButton"
        type="button"
        onClick={() => {
          setMonthDate(value || today);
          setIsOpen((current) => !current);
        }}
      >
        <Calendar size={17} />
        <strong>{value ? formatDateLabel(value) : "Select date"}</strong>
      </button>
      {isOpen && (
        <div className="formCalendarPopover">
          <MiniCalendarPicker
            monthDate={monthDate}
            selectedDate={value}
            today={today}
            onClose={() => setIsOpen(false)}
            onMonthChange={setMonthDate}
            onSelect={(date) => {
              onChange(date);
              setIsOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Avatar({ profile, small = false, url }) {
  return (
    <div className={small ? "avatar face small" : "avatar face"}>
      {url ? <img src={url} alt="" /> : makeInitials(profile?.full_name || profile?.email || "No Name", "NN")}
    </div>
  );
}

function getEquipmentAvatarOption(item = {}) {
  const legacyKey = item.icon === "loader" ? "skid_steer" : item.icon;
  const key = item.avatar_key || legacyKey || "excavator";
  return equipmentAvatarOptions.find((option) => option.key === key) ?? equipmentAvatarOptions[0];
}

function EquipmentAvatar({ item, small = false }) {
  const option = getEquipmentAvatarOption(item);
  const Icon = option.Icon;
  return (
    <div className={`equipmentAvatar ${option.key} ${small ? "small" : ""}`} title={option.label}>
      <Icon size={small ? 17 : 21} />
    </div>
  );
}

function setCompactDragImage(event, { count = 1, label = "", tone = "crew" }) {
  if (!event.dataTransfer || typeof event.dataTransfer.setDragImage !== "function") return;
  const ghost = document.createElement("div");
  ghost.className = `dragGhostPill ${tone}`;
  ghost.innerHTML = `<span>${count}</span><strong>${label}</strong>`;
  document.body.appendChild(ghost);
  const rect = ghost.getBoundingClientRect();
  event.dataTransfer.setDragImage(ghost, Math.min(46, rect.width / 2), Math.min(18, rect.height / 2));
  window.requestAnimationFrame(() => ghost.remove());
}

export default function App() {
  const globalSearchRef = useRef(null);
  const searchInputRef = useRef(null);
  const activeEditLockRef = useRef(null);
  const confirmationResolverRef = useRef(null);
  const editorInitialSnapshotRef = useRef({ project: "", visit: "" });
  const [activeNav, setActiveNav] = useState("overview");
  const [scheduleMode, setScheduleMode] = useState("day");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState({ ...demo, visits: [] });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [detailOverlay, setDetailOverlay] = useState("");
  const [detailOverlayStack, setDetailOverlayStack] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [softPulse, setSoftPulse] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authAvatarFile, setAuthAvatarFile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [viewerItems, setViewerItems] = useState([]);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [isAnnotatingPhoto, setIsAnnotatingPhoto] = useState(false);
  const [projectWeather, setProjectWeather] = useState({ status: "idle", address: "", data: null });
  const [modalType, setModalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeEditLock, setActiveEditLock] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingEquipmentId, setEditingEquipmentId] = useState(null);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [companyForm, setCompanyForm] = useState({ company_name: "BuildCore Construction", full_name: "", phone: "" });
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [visitForm, setVisitForm] = useState(emptyVisitForm);
  const [safetyForm, setSafetyForm] = useState({ hazards: [], notes: "", signatures: {}, presentIds: [] });
  const [workflowVisitId, setWorkflowVisitId] = useState("");
  const [photoStep, setPhotoStep] = useState({ kind: "", visitId: "", files: [], captions: {} });
  const [completionForm, setCompletionForm] = useState({ notes: "", files: [], captions: {} });
  const [uploadProgress, setUploadProgress] = useState(null);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", avatarFile: null, removeAvatar: false });
  const [personForm, setPersonForm] = useState({ first_name: "", last_name: "", phone: "", role: "builder", trade: "", availability_status: "available" });
  const [featureFlags, setFeatureFlags] = useState(defaultFeatureFlags);
  const [developerForm, setDeveloperForm] = useState({ ...defaultFeatureFlags, botCount: "10" });
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [avatarUrls, setAvatarUrls] = useState({});
  const accountMenuRef = useRef(null);

  const isLive = Boolean(session && profile?.is_active);
  const canManage = Boolean(profile?.is_active && ["owner", "project_manager", "office_manager"].includes(profile?.role));
  const canDeleteTickets = Boolean(profile?.is_active && profile?.role !== "builder");
  const activeFeatureFlags = normalizeFeatureFlags(featureFlags);
  const canUseDeveloperMode = Boolean(profile?.is_active && profile?.role !== "builder");
  const visibleNavItems = (canManage ? navItems : navItems.filter((item) => !["people", "equipment"].includes(item.id))).filter((item) => activeFeatureFlags.safetyForm || item.id !== "safetyReports");
  const currentUserName = profile?.full_name || session?.user?.email || "James Carter";

  const refreshData = useCallback(async () => {
    if (!supabase || !session) return;
    const cachedWorkspace = await readCachedWorkspace(session.user.id);
    const canUseCachedWorkspace = cachedWorkspace?.profile?.id === session.user.id && cachedWorkspace?.data?.companyId;
    setLoading(!canUseCachedWorkspace);

    try {
      let profileResult = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (profileResult.error) throw profileResult.error;

      if (!profileResult.data) {
        const claimResult = await supabase.rpc("claim_owner_invite");
        if (!claimResult.error && claimResult.data) {
          profileResult = { data: claimResult.data, error: null };
          setNotice("Owner account verified and connected.");
        } else {
          const requestResult = await supabase.rpc("request_employee_access");
          if (!requestResult.error && requestResult.data) {
            profileResult = { data: requestResult.data, error: null };
            setNotice("Access request sent. A manager must approve this account before the app opens.");
          } else {
            setProfile(null);
            setData({ ...demo, visits: [], pendingPeople: [] });
            setNotice(
              requestResult.error?.message?.includes("verify") || claimResult.error?.message?.includes("verify")
                ? "Check your email and confirm the account before continuing."
                : requestResult.error?.message || "Supabase did not confirm access for this account.",
            );
            await supabase.auth.signOut();
            return;
          }
        }
      }

      let nextProfile = profileResult.data;
      if (session.user.email && nextProfile.email !== session.user.email) {
        const profileEmailResult = await supabase.from("profiles").update({ email: session.user.email }).eq("id", nextProfile.id).select().single();
        if (!profileEmailResult.error && profileEmailResult.data) nextProfile = profileEmailResult.data;
      }

      await applyPendingSignupProfile(nextProfile);
      setProfile(nextProfile);

      if (!nextProfile.is_active) {
        setData({ ...demo, visits: [], pendingPeople: [nextProfile] });
        return;
      }

      if (canUseCachedWorkspace && cachedWorkspace.data.companyId === nextProfile.company_id) {
        const cachedFeatureFlags = normalizeFeatureFlags(cachedWorkspace.data.featureFlags);
        setData({
          ...cachedWorkspace.data,
          featureFlags: cachedFeatureFlags,
          people: (cachedWorkspace.data.people ?? []).filter((person) => !person.is_bot || cachedFeatureFlags.testBots),
          pendingPeople: (cachedWorkspace.data.pendingPeople ?? []).filter((person) => !person.is_bot),
        });
        setFeatureFlags(cachedFeatureFlags);
      }

      const nextCanManage = ["owner", "project_manager", "office_manager"].includes(nextProfile.role);
      const peopleQuery = nextCanManage
        ? supabase.from("profiles").select("*").order("is_active", { ascending: true }).order("full_name")
        : supabase.from("profiles").select("*").eq("is_active", true).order("full_name");

      const [companyResult, projectsResult, peopleResult, equipmentResult, visitsResult, filesResult, activityResult] = await Promise.all([
        supabase.from("companies").select("feature_flags").eq("id", nextProfile.company_id).single(),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        peopleQuery,
        supabase.from("equipment").select("*").order("name"),
        supabase.from("visit_schedule_view").select("*").order("visit_date", { ascending: false }).order("start_time"),
        supabase.from("visit_files").select("*").order("created_at", { ascending: false }),
        supabase.from("visit_activity").select("*").order("created_at", { ascending: false }).limit(500),
      ]);

      const failed = [companyResult, projectsResult, peopleResult, equipmentResult, visitsResult, filesResult, activityResult].find((result) => result.error);
      if (failed) throw failed.error;

      const nextProjects = projectsResult.data ?? [];
      const allPeople = peopleResult.data ?? [];
      const nextFeatureFlags = normalizeFeatureFlags(companyResult.data?.feature_flags);
      setFeatureFlags(nextFeatureFlags);
      const nextData = {
        companyId: nextProfile.company_id,
        featureFlags: nextFeatureFlags,
        projects: nextProjects,
        people: allPeople.filter((person) => person.is_active && (!person.is_bot || nextFeatureFlags.testBots)),
        pendingPeople: allPeople.filter((person) => !person.is_active && !person.is_bot),
        equipment: equipmentResult.data ?? [],
        visits: visitsResult.data ?? [],
        files: filesResult.data ?? [],
        activities: activityResult.data ?? [],
      };
      setData(nextData);
      writeCachedWorkspace(session.user.id, { profile: nextProfile, data: nextData });

      if (selectedProjectId && !nextProjects.some((project) => project.id === selectedProjectId)) setSelectedProjectId("");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, session]);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setAuthReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.querySelector(".sideNavItem.active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeNav]);

  useEffect(() => {
    if ((activeNav === "people" || activeNav === "equipment") && !canManage) setActiveNav("overview");
    if (activeNav === "safetyReports" && !activeFeatureFlags.safetyForm) setActiveNav("overview");
  }, [activeFeatureFlags.safetyForm, activeNav, canManage]);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;
    function handlePointerDown(event) {
      if (accountMenuRef.current?.contains(event.target)) return;
      setIsAccountMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isAccountMenuOpen]);

  useEffect(() => {
    if (!session) return;
    refreshData();
  }, [refreshData, session]);

  useEffect(() => {
    if (!profile) return;
    const [first = "", ...rest] = String(profile.full_name || "").split(" ").filter(Boolean);
    setProfileForm({
      first_name: profile.first_name || first,
      last_name: profile.last_name || rest.join(" "),
      phone: profile.phone || "",
      avatarFile: null,
      removeAvatar: false,
    });
  }, [profile]);

  useEffect(() => {
    activeEditLockRef.current = activeEditLock;
  }, [activeEditLock]);

  useEffect(() => {
    if (!supabase || !activeEditLock?.lockKey) return undefined;

    const heartbeat = window.setInterval(async () => {
      const { data: lockResult, error } = await supabase
        .rpc("acquire_edit_lock", {
          p_lock_key: activeEditLock.lockKey,
          p_resource_type: activeEditLock.resourceType,
          p_resource_id: activeEditLock.resourceId,
          p_mode: activeEditLock.mode,
          p_hold_seconds: 20,
        })
        .single();

      if (error || !lockResult?.acquired) {
        setNotice(error?.message || `${activeEditLock.label === "ticket" ? "This ticket" : "This project"} is now locked by ${lockResult?.holder_name || "another user"}.`);
        setActiveEditLock(null);
        activeEditLockRef.current = null;
        setModalType(null);
      }
    }, 6000);

    return () => window.clearInterval(heartbeat);
  }, [activeEditLock]);

  useEffect(() => {
    if (!supabase) return undefined;
    const handlePageHide = () => {
      void releaseEditLock(activeEditLockRef.current);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  useEffect(() => {
    if (!supabase || !profile?.is_active || !profile.company_id) return undefined;

    const channel = supabase
      .channel(`buildcore-workspace-${profile.company_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter: `id=eq.${profile.company_id}` }, (payload) => {
        const nextFeatureFlags = normalizeFeatureFlags(payload.new?.feature_flags);
        setFeatureFlags(nextFeatureFlags);
        setData((current) => ({ ...current, featureFlags: nextFeatureFlags }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter: `company_id=eq.${profile.company_id}` }, () => {
        void loadVisits();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_people" }, () => {
        void loadVisits();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_equipment" }, () => {
        void loadVisits();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_activity", filter: `company_id=eq.${profile.company_id}` }, () => {
        void loadActivities();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_files", filter: `company_id=eq.${profile.company_id}` }, () => {
        void loadFiles();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, profile?.is_active]);

  useEffect(() => {
    let alive = true;
    const profiles = [profile, ...(data.people ?? []), ...(data.pendingPeople ?? [])].filter(Boolean).filter((item) => item.avatar_path);
    if (profiles.length === 0) return undefined;

    async function loadAvatars() {
      const pairs = await Promise.all(
        profiles.map(async (item) => {
          try {
            return [item.id, await createProfileAvatarUrl(item.avatar_path)];
          } catch {
            return [item.id, ""];
          }
        }),
      );
      if (alive) setAvatarUrls((current) => ({ ...current, ...Object.fromEntries(pairs) }));
    }

    loadAvatars();
    return () => {
      alive = false;
    };
  }, [data.people, profile]);

  const projectLookup = useMemo(() => new Map(data.projects.map((project, index) => [project.id, { ...project, color: colors[index % colors.length] }])), [data.projects]);

  const liveAssignments = useMemo(() => {
    if (!isLive) return demoAssignments;

    return (data.visits ?? [])
      .filter((visit) => visit.visit_date === selectedDate)
      .flatMap((visit) => {
      const project = projectLookup.get(visit.project_id);
      const base = {
        visitId: visit.id,
        projectId: visit.project_id,
        title: project?.name ?? "Project visit",
        subtitle: visit.work_scope || normalizeVisitStatus(visit.status),
        start: toHour(visit.start_time),
        end: toHour(visit.end_time),
        timeText: formatTimeRange(visit.start_time, visit.end_time),
        status: visit.status,
        isFirstVisit: visit.is_first_visit,
        color: project?.color ?? "blue",
      };

      return [
        ...(visit.people_ids ?? []).map((profileId) => ({ ...base, id: `${visit.id}-${profileId}`, type: "person", resourceId: profileId })),
        ...(visit.equipment_ids ?? []).map((equipmentId) => ({ ...base, id: `${visit.id}-${equipmentId}`, type: "equipment", resourceId: equipmentId })),
      ];
    });
  }, [data.visits, isLive, projectLookup, selectedDate]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      if (supabase && session && profile) {
        const { data: results, error } = await supabase.rpc("global_search", { search_query: query });
        if (!error) {
          setSearchResults(results ?? []);
          return;
        }
      }

      setSearchResults(localGlobalSearch({ ...data, visits: liveAssignments }, query));
    }, 160);

    return () => window.clearTimeout(handle);
  }, [data, liveAssignments, profile, searchQuery, session]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const handle = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => window.clearTimeout(handle);
  }, [isSearchOpen]);

  useEffect(() => {
    const locked = isSearchOpen || Boolean(detailOverlay) || Boolean(modalType) || Boolean(selectedAttachment) || isMobileMenuOpen || Boolean(confirmation);
    document.body.classList.toggle("overlayLocked", locked);
    return () => document.body.classList.remove("overlayLocked");
  }, [confirmation, detailOverlay, isMobileMenuOpen, isSearchOpen, modalType, selectedAttachment]);

  useEffect(() => {
    if (!isLive || loading || !notice) return undefined;
    const handle = window.setTimeout(() => setNotice(""), 3400);
    return () => window.clearTimeout(handle);
  }, [isLive, loading, notice]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      if (detailOverlay) {
        closeDetailOverlay();
        return;
      }
      setIsSearchOpen(false);
      setSearchResults([]);
      clearDetailOverlay();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detailOverlay]);

  const rowsSource = isLive ? data : demo;
  const assignmentsSource = isLive ? liveAssignments : demoAssignments;
  const isRefreshingWorkspace = Boolean(isLive && loading && profile?.is_active && (data.projects?.length || data.people?.length || data.equipment?.length || data.files?.length));
  const profileById = useMemo(() => new Map((rowsSource.people ?? []).map((person) => [person.id, person])), [rowsSource.people]);
  const getProfileName = useCallback((id, fallback = "Not set") => profileDisplayName(profileById.get(id), fallback), [profileById]);
  const selectedProject = selectedProjectId ? rowsSource.projects.find((project) => project.id === selectedProjectId) : null;
  const selectedAssignment = assignmentsSource.find((item) => item.id === selectedAssignmentId) ?? null;
  const selectedProjectVisits = selectedProject
    ? (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === selectedProject.id)
        .sort((a, b) => `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`))
    : [];
  const selectedVisit = selectedVisitId ? selectedProjectVisits.find((visit) => visit.id === selectedVisitId) ?? null : null;
  const currentVisit = selectedVisit ?? selectedProjectVisits[0] ?? null;
  const currentVisitFiles = (rowsSource.files ?? []).filter((file) => currentVisit?.id && file.visit_id === currentVisit.id);
  const currentVisitPeople = currentVisit ? rowsSource.people.filter((person) => currentVisit.people_ids?.includes(person.id)) : [];
  const currentVisitEquipment = currentVisit ? rowsSource.equipment.filter((item) => currentVisit.equipment_ids?.includes(item.id)) : [];
  const selectedProjectActivities = selectedProject ? (rowsSource.activities ?? []).filter((item) => item.project_id === selectedProject.id) : [];
  const workflowVisit = workflowVisitId ? (rowsSource.visits ?? []).find((visit) => visit.id === workflowVisitId) ?? currentVisit : currentVisit;
  const workflowProject = workflowVisit ? rowsSource.projects.find((project) => project.id === workflowVisit.project_id) ?? selectedProject : selectedProject;
  const workflowPeople = workflowVisit ? rowsSource.people.filter((person) => workflowVisit.people_ids?.includes(person.id)) : currentVisitPeople;
  const selectedPerson = selectedPersonId ? [...(rowsSource.people ?? []), ...(rowsSource.pendingPeople ?? [])].find((person) => person.id === selectedPersonId) : null;
  const todayValue = new Date().toISOString().slice(0, 10);
  const todayVisits = (rowsSource.visits ?? [])
    .filter((visit) => visit.visit_date === todayValue && (!isLive || visit.people_ids?.includes(profile?.id)))
    .sort((a, b) => {
      const statusOrder = { on_site: 0, planned: 1, completed: 2, cancelled: 3 };
      return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4) || String(a.start_time).localeCompare(String(b.start_time));
    });
  const projectAttachments = (rowsSource.files ?? [])
    .filter((file) => selectedProject && (file.project_id === selectedProject.id || file.projectId === selectedProject.id) && !file.visit_id);

  useEffect(() => {
    let alive = true;
    const address = selectedProject?.address;

    if (!address) {
      setProjectWeather({ status: "idle", address: "", data: null });
      return undefined;
    }

    setProjectWeather({ status: "loading", address, data: null });
    const handle = window.setTimeout(async () => {
      try {
        const weather = await getWeatherForAddress(address);
        if (alive) setProjectWeather({ status: "ready", address, data: weather });
      } catch (error) {
        if (alive) setProjectWeather({ status: "error", address, data: null, message: error.message });
      }
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(handle);
    };
  }, [selectedProject?.address]);

  const peopleRows = rowsSource.people.map((person) => ({
    ...person,
    kind: "person",
    subtitle: roleLabel(person.role),
    resourceStatus: getPersonWorkStatus({ date: selectedDate, person: person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
    peopleStatus: getPersonWorkStatus({ date: todayValue, person: person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
    assignments: assignmentsSource.filter((item) => item.type === "person" && item.resourceId === person.id),
  }));

  const equipmentRows = rowsSource.equipment.map((equipment) => ({
    ...equipment,
    kind: "equipment",
    full_name: equipment.name,
    subtitle: equipment.type,
    resourceStatus: getEquipmentWorkStatus({ date: selectedDate, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
    assignments: assignmentsSource.filter((item) => item.type === "equipment" && item.resourceId === equipment.id),
  }));
  const projectRows = rowsSource.projects
    .map((project, index) => {
      const projectVisits = (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === project.id && visit.visit_date === selectedDate && visit.status !== "cancelled")
        .sort((a, b) => `${a.start_time} ${a.end_time}`.localeCompare(`${b.start_time} ${b.end_time}`));
      const visitLanes = packVisitLanes(projectVisits);
      return {
        ...project,
        kind: "project",
        full_name: project.name,
        subtitle: project.job_number || project.address,
        color: colors[index % colors.length],
        laneCount: visitLanes.laneCount,
        assignments: projectVisits.map((visit) => ({
          visitId: visit.id,
          projectId: visit.project_id,
          title: project.name,
          subtitle: visit.work_scope || normalizeVisitStatus(visit.status),
          start: toHour(visit.start_time),
          end: toHour(visit.end_time),
          timeText: formatTimeRange(visit.start_time, visit.end_time),
          status: visit.status,
          isFirstVisit: visit.is_first_visit,
          color: colors[index % colors.length],
          people: rowsSource.people.filter((person) => visit.people_ids?.includes(person.id)),
          equipment: rowsSource.equipment.filter((item) => visit.equipment_ids?.includes(item.id)),
          laneIndex: visitLanes.laneByVisitId.get(visit.id) ?? 0,
          laneCount: visitLanes.laneCount,
        })),
      };
    })
    .filter((project) => project.assignments.length > 0);
  const availableTodayPeople = rowsSource.people.filter((person) => getPersonWorkStatus({ date: selectedDate, person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }).tone === "available");
  const availableTodayEquipment = rowsSource.equipment.filter((equipment) => getEquipmentWorkStatus({ date: selectedDate, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }).tone === "available");
  const visitPickerPeople = rowsSource.people.map((person) => ({
    ...person,
    pickerStatus: getPersonWorkStatus({ date: visitForm.visit_date, person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
  }));
  const visitPickerEquipment = rowsSource.equipment.map((equipment) => ({
    ...equipment,
    pickerStatus: getEquipmentWorkStatus({ date: visitForm.visit_date, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
  }));
  const visitFormDates = editingVisitId ? [visitForm.visit_date] : collectVisitDates(visitForm.visit_date, Math.max(1, parseWorkDayCount(visitForm.duration_days)));
  const visitWorkScopes = normalizeWorkScopes(visitForm.work_scopes, visitFormDates.length, visitForm.work_scope);
  const safetyFormHasDraft =
    safetyForm.hazards.length > 0 ||
    safetyForm.notes.trim().length > 0 ||
    Object.values(safetyForm.signatures ?? {}).some((signature) => String(signature ?? "").trim().length > 0);
  const beforePhotosHaveDraft =
    (photoStep.files?.length ?? 0) > 0 ||
    Object.values(photoStep.captions ?? {}).some((caption) => String(caption ?? "").trim().length > 0);
  const completionHasDraft =
    completionForm.notes.trim().length > 0 ||
    (completionForm.files?.length ?? 0) > 0 ||
    Object.values(completionForm.captions ?? {}).some((caption) => String(caption ?? "").trim().length > 0);

  function confirmAction(options) {
    return new Promise((resolve) => {
      confirmationResolverRef.current = resolve;
      setConfirmation({
        confirmLabel: "Confirm",
        cancelLabel: "Cancel",
        danger: false,
        message: "",
        title: "Are you sure?",
        ...options,
      });
    });
  }

  function triggerSoftPulse() {
    setSoftPulse(false);
    window.requestAnimationFrame(() => {
      setSoftPulse(true);
      window.setTimeout(() => setSoftPulse(false), 680);
    });
  }

  function resolveConfirmation(value) {
    const resolver = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setConfirmation(null);
    resolver?.(value);
  }

  async function closeModalWithConfirmation(hasUnsavedDraft = false) {
    if (
      hasUnsavedDraft &&
      !(await confirmAction({
        title: "Close without saving?",
        message: "You have unsaved changes in this form.",
        confirmLabel: "Close",
        danger: true,
      }))
    ) {
      return;
    }
    setModalType(null);
  }

  function makeEditLock({ resourceId = "", resourceType }) {
    const lockKey = `${resourceType}:${resourceId || "new"}`;
    const label = resourceType === "visit" ? "ticket" : "project";
    return { lockKey, resourceId: resourceId || null, resourceType, label };
  }

  async function releaseEditLock(lock = activeEditLockRef.current) {
    if (!supabase || !lock?.lockKey) return;
    try {
      await supabase.rpc("release_edit_lock", {
        p_lock_key: lock.lockKey,
        p_release_hold_seconds: 10,
      });
    } catch {
      // The lock also has a short TTL, so a failed release will clear itself.
    }
  }

  async function closeEditorModal() {
    const editorKind = modalType === "project" || modalType === "visit" ? modalType : "";
    const hasUnsavedEditorChanges =
      editorKind === "project"
        ? editorInitialSnapshotRef.current.project && editorInitialSnapshotRef.current.project !== serializeProjectEditorForm(projectForm)
        : editorKind === "visit" && editorInitialSnapshotRef.current.visit && editorInitialSnapshotRef.current.visit !== serializeVisitEditorForm(visitForm);

    if (
      hasUnsavedEditorChanges &&
      !(await confirmAction({
        title: "Close without saving?",
        message: editorKind === "project" ? "Project changes were not saved." : "Ticket changes were not saved.",
        confirmLabel: "Close",
        danger: true,
      }))
    ) {
      return;
    }

    const lock = activeEditLockRef.current;
    setModalType(null);
    setEditingProjectId(null);
    setEditingVisitId(null);
    setActiveEditLock(null);
    activeEditLockRef.current = null;
    editorInitialSnapshotRef.current = { project: "", visit: "" };
    await releaseEditLock(lock);
  }

  async function acquireEditLock({ mode = "edit", resourceId = "", resourceType }) {
    if (!supabase || !profile || !canManage) return true;

    const lock = makeEditLock({ resourceId, resourceType });
    if (activeEditLockRef.current?.lockKey === lock.lockKey) return true;
    if (activeEditLockRef.current?.lockKey) await releaseEditLock(activeEditLockRef.current);

    const { data: lockResult, error } = await supabase
      .rpc("acquire_edit_lock", {
        p_lock_key: lock.lockKey,
        p_resource_type: resourceType,
        p_resource_id: resourceId || null,
        p_mode: mode,
        p_hold_seconds: 20,
      })
      .single();

    if (error) {
      setNotice(error.message);
      return false;
    }

    if (!lockResult?.acquired) {
      setNotice(`${lock.label === "ticket" ? "This ticket" : "This project"} is locked by ${lockResult?.holder_name || "another user"}. Try again in a few seconds.`);
      return false;
    }

    const nextLock = { ...lock, mode };
    activeEditLockRef.current = nextLock;
    setActiveEditLock(nextLock);
    return true;
  }

  function commitWorkspaceData(updater) {
    setData((current) => {
      const nextData = typeof updater === "function" ? updater(current) : updater;
      if (session?.user?.id && profile?.id && nextData?.companyId) writeCachedWorkspace(session.user.id, { profile, data: nextData });
      return nextData;
    });
  }

  async function loadVisits({ quiet = true } = {}) {
    if (!supabase || !session) return;
    if (!quiet) setLoading(true);
    try {
      const { data: visits, error } = await supabase.from("visit_schedule_view").select("*").order("visit_date", { ascending: false }).order("start_time");
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, visits: visits ?? [] }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadFiles({ quiet = true } = {}) {
    if (!supabase || !session) return;
    if (!quiet) setLoading(true);
    try {
      const { data: files, error } = await supabase.from("visit_files").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, files: files ?? [] }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadActivities({ quiet = true } = {}) {
    if (!supabase || !session) return;
    if (!quiet) setLoading(true);
    try {
      const { data: activities, error } = await supabase.from("visit_activity").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, activities: activities ?? [] }));
    } catch (error) {
      setNotice(error.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function applyPendingSignupProfile(nextProfile) {
    if (!supabase || !nextProfile?.id || !nextProfile.company_id || !session?.user?.email) return;

    const key = `buildcore_pending_profile_${session.user.email.toLowerCase()}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    window.localStorage.removeItem(key);
    const pending = JSON.parse(raw);
    const firstName = pending.firstName || "";
    const lastName = pending.lastName || "";
    const phone = pending.phone || nextProfile.phone || "";
    let avatarPath = nextProfile.avatar_path || null;

    if (pending.avatarDataUrl) {
      const avatarFile = await dataUrlToFile(pending.avatarDataUrl, pending.avatarName || "avatar.jpg", pending.avatarType || "image/jpeg");
      avatarPath = await uploadProfileAvatar({ companyId: nextProfile.company_id, profileId: nextProfile.id, file: avatarFile });
    }

    if (firstName || lastName || phone || avatarPath) {
      await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim() || nextProfile.full_name,
          email: session.user.email,
          phone,
          avatar_path: avatarPath,
        })
        .eq("id", nextProfile.id);
    }
  }

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    const normalizedEmail = authEmail.trim().toLowerCase();
    const firstName = authFirstName.trim();
    const lastName = authLastName.trim();
    const phone = authPhone.trim();

    if (authMode === "signup" && (!firstName || !lastName || !phone)) {
      setLoading(false);
      setNotice("First name, last name, and phone number are required.");
      return;
    }

    if (authMode === "signup") {
      const pendingProfile = {
        firstName,
        lastName,
        phone,
        avatarDataUrl: authAvatarFile ? await fileToDataUrl(authAvatarFile) : "",
        avatarName: authAvatarFile?.name || "",
        avatarType: authAvatarFile?.type || "",
      };
      window.localStorage.setItem(`buildcore_pending_profile_${normalizedEmail}`, JSON.stringify(pendingProfile));
    }

    const action =
      authMode === "signup"
        ? supabase.auth.signUp({
            email: normalizedEmail,
            password: authPassword,
            options: {
              emailRedirectTo: getAuthRedirectUrl(),
              data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim(), phone },
            },
          })
        : supabase.auth.signInWithPassword({ email: normalizedEmail, password: authPassword });
    const { error } = await action;
    setLoading(false);

    if (error) {
      setNotice(`${error.message}. Supabase did not confirm this account.`);
      return;
    }

    setNotice(authMode === "signup" ? "Account created. Check your email to verify it, then return here and sign in." : "");
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsMobileMenuOpen(false);
    setProfile(null);
    setData({ ...demo, visits: [] });
    setSelectedProjectId("");
    setSelectedVisitId("");
    setSelectedAssignmentId("");
    setSelectedPersonId("");
    setWorkflowVisitId("");
    clearDetailOverlay();
  }

  async function createCompany(event) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    const { error } = await supabase.rpc("create_company_for_current_user", companyForm);
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setModalType(null);
    setNotice("Company created. You are Owner now.");
    refreshData();
  }

  async function saveProject(event) {
    event.preventDefault();
    if (!supabase || !profile) return;

    setLoading(true);

    const payload = {
      job_number: projectForm.job_number,
      name: projectForm.name,
      address: projectForm.address,
      manager_id: projectForm.manager_id || profile.id,
      contact_name: projectForm.contact_name,
      contact_email: projectForm.contact_email,
      contact_phone: projectForm.contact_phone,
      description: projectForm.description,
      status: projectForm.status,
    };

    const query = editingProjectId
      ? supabase.from("projects").update(payload).eq("id", editingProjectId).select().single()
      : supabase
          .from("projects")
          .insert({
            ...payload,
            company_id: profile.company_id,
            created_by: profile.id,
            manager_id: profile.id,
          })
          .select()
          .single();

    const { data: saved, error } = await query;
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    const lockToRelease = activeEditLockRef.current;
    setProjectForm(emptyProjectForm);
    setEditingProjectId(null);
    setModalType(null);
    setActiveEditLock(null);
    activeEditLockRef.current = null;
    editorInitialSnapshotRef.current.project = "";
    await releaseEditLock(lockToRelease);
    commitWorkspaceData((current) => {
      const projects = current.projects ?? [];
      const nextProjects = editingProjectId ? projects.map((project) => (project.id === saved.id ? saved : project)) : [saved, ...projects];
      return { ...current, projects: nextProjects };
    });
    setSelectedProjectId(saved.id);
    triggerSoftPulse();
    setNotice(editingProjectId ? "Project changes saved." : "Project saved.");
  }

  async function editProject(project) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can edit projects.");
      return;
    }
    if (!(await acquireEditLock({ mode: "edit", resourceId: project.id, resourceType: "project" }))) return;

    setEditingProjectId(project.id);
    const nextProjectForm = {
      job_number: project.job_number ?? "",
      name: project.name ?? "",
      address: project.address ?? "",
      manager_id: project.manager_id ?? project.created_by ?? profile?.id ?? "",
      contact_name: project.contact_name ?? "",
      contact_email: project.contact_email ?? "",
      contact_phone: project.contact_phone ?? "",
      description: project.description ?? "",
      status: project.status && projectStatusMap[project.status] ? project.status : "planning",
    };
    setProjectForm(nextProjectForm);
    editorInitialSnapshotRef.current.project = serializeProjectEditorForm(nextProjectForm);
    setModalType("project");
  }

  async function deleteProject(project) {
    if (!supabase || !canManage) {
      setNotice("Sign in as Owner, PM, or Office Manager to delete projects.");
      return;
    }

    const confirmed = await confirmAction({
      title: "Delete project?",
      message: `Delete "${project.name}" and its scheduled visits?`,
      confirmLabel: "Delete project",
      danger: true,
    });
    if (!confirmed) return;

    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      projects: (current.projects ?? []).filter((item) => item.id !== project.id),
      visits: (current.visits ?? []).filter((visit) => visit.project_id !== project.id),
      files: (current.files ?? []).filter((file) => file.project_id !== project.id),
      activities: (current.activities ?? []).filter((activity) => activity.project_id !== project.id),
    }));
    setLoading(true);
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    setLoading(false);

    if (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      return;
    }

    triggerSoftPulse();
    setNotice("Project deleted.");
    setSelectedProjectId("");
    setSelectedVisitId("");
  }

  async function saveEquipment(event) {
    event.preventDefault();
    if (!supabase || !profile) return;

    setLoading(true);
    const payload = {
      ...equipmentForm,
      avatar_key: equipmentForm.avatar_key || "excavator",
      company_id: profile.company_id,
    };
    const { error } = editingEquipmentId
      ? await supabase.from("equipment").update(payload).eq("id", editingEquipmentId)
      : await supabase.from("equipment").insert(payload);
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setEquipmentForm(emptyEquipmentForm);
    setEditingEquipmentId(null);
    setModalType(null);
    triggerSoftPulse();
    setNotice(editingEquipmentId ? "Equipment changes saved." : "Equipment saved.");
    refreshData();
  }

  async function saveVisit(event) {
    event.preventDefault();
    if (!supabase || !profile) return;

    const requestedWorkDays = editingVisitId ? 1 : parseWorkDayCount(visitForm.duration_days);
    if (!editingVisitId && requestedWorkDays < 1) {
      setNotice("Enter at least 1 work day before saving the visit.");
      return;
    }

    setLoading(true);
    const baseVisitPayload = {
      project_id: visitForm.project_id,
      start_time: visitForm.start_time,
      end_time: visitForm.end_time,
    };

    const createdVisitIds = [];
    const generatedDates = editingVisitId ? [visitForm.visit_date] : collectVisitDates(visitForm.visit_date, requestedWorkDays);
    const workScopes = normalizeWorkScopes(visitForm.work_scopes, generatedDates.length, visitForm.work_scope).map((scope) => scope.trim());

    if (workScopes.some((scope) => !scope)) {
      setLoading(false);
      setNotice("Add a Work Scope for every scheduled work day.");
      return;
    }

    const notAvailablePeople = rowsSource.people.filter((person) => visitForm.people_ids.includes(person.id) && person.availability_status === "not_available");
    if (notAvailablePeople.length) {
      setLoading(false);
      setNotice(`Ticket not saved: ${notAvailablePeople.map((person) => profileDisplayName(person)).join(", ")} marked Not Available.`);
      return;
    }

    const conflictMessages = generatedDates.flatMap((visitDate) =>
      describeVisitConflict({
        candidate: {
          visit_date: visitDate,
          start_time: visitForm.start_time,
          end_time: visitForm.end_time,
          people_ids: visitForm.people_ids,
          equipment_ids: visitForm.equipment_ids,
        },
        visits: rowsSource.visits ?? [],
        projects: rowsSource.projects,
        people: rowsSource.people,
        equipment: rowsSource.equipment,
        editingVisitId,
      }),
    );

    if (conflictMessages.length) {
      setLoading(false);
      setNotice(`Ticket not saved: ${conflictMessages.slice(0, 3).join("; ")}.`);
      return;
    }

    try {
      let firstVisit = null;
      const savedVisits = [];

      for (const [index, visitDate] of generatedDates.entries()) {
        const visitPayload = {
          ...baseVisitPayload,
          visit_date: visitDate,
          work_scope: workScopes[index],
          is_first_visit: Boolean(visitForm.is_first_visit && index === 0),
        };

        const visitQuery = editingVisitId
          ? supabase.from("visits").update(visitPayload).eq("id", editingVisitId).select().single()
          : supabase
              .from("visits")
              .insert({
                ...visitPayload,
                company_id: profile.company_id,
                created_by: profile.id,
                assigned_by: profile.id,
              })
              .select()
              .single();

        const { data: visit, error: visitError } = await visitQuery;
        if (visitError) throw visitError;
        if (!firstVisit) firstVisit = visit;
        savedVisits.push({ ...visit, people_ids: visitForm.people_ids, equipment_ids: visitForm.equipment_ids });
        if (!editingVisitId) createdVisitIds.push(visit.id);

        if (editingVisitId) {
          const clearPeople = await supabase.from("visit_people").delete().eq("visit_id", visit.id);
          const clearEquipment = await supabase.from("visit_equipment").delete().eq("visit_id", visit.id);
          if (clearPeople.error || clearEquipment.error) throw clearPeople.error || clearEquipment.error;
        }

        const peopleRowsToInsert = visitForm.people_ids.map((profileId) => ({ visit_id: visit.id, profile_id: profileId }));
        const equipmentRowsToInsert = visitForm.equipment_ids.map((equipmentId) => ({ visit_id: visit.id, equipment_id: equipmentId }));
        const peopleResult = peopleRowsToInsert.length ? await supabase.from("visit_people").insert(peopleRowsToInsert) : { error: null };
        const equipmentResult = equipmentRowsToInsert.length ? await supabase.from("visit_equipment").insert(equipmentRowsToInsert) : { error: null };
        const assignmentError = peopleResult.error || equipmentResult.error;
        if (assignmentError) throw assignmentError;
      }

      setLoading(false);
      const lockToRelease = activeEditLockRef.current;
      setVisitForm({ ...emptyVisitForm, visit_date: selectedDate, project_id: rowsSource.projects[0]?.id ?? "" });
      setEditingVisitId(null);
      setModalType(null);
      setActiveEditLock(null);
      activeEditLockRef.current = null;
      editorInitialSnapshotRef.current.visit = "";
      await releaseEditLock(lockToRelease);
      commitWorkspaceData((current) => {
        const savedIds = new Set(savedVisits.map((visit) => visit.id));
        const keptVisits = (current.visits ?? []).filter((visit) => !savedIds.has(visit.id));
        return {
          ...current,
          visits: [...savedVisits, ...keptVisits].sort((a, b) => `${b.visit_date} ${b.start_time}`.localeCompare(`${a.visit_date} ${a.start_time}`)),
        };
      });
      setSelectedDate(firstVisit.visit_date);
      setSelectedProjectId(firstVisit.project_id);
      setSelectedVisitId(firstVisit.id);
      triggerSoftPulse();
      setNotice(
        editingVisitId
          ? "Ticket changes saved."
          : `${generatedDates.length} ticket${generatedDates.length === 1 ? "" : "s"} saved.${requestedWorkDays > 1 ? " Weekends skipped." : ""}`,
      );
      loadVisits();
    } catch (error) {
      if (!editingVisitId && createdVisitIds.length > 0) await supabase.from("visits").delete().in("id", createdVisitIds);
      setLoading(false);
      setNotice(error.message);
      loadVisits();
    }
  }

  async function updateRole(person, role) {
    if (!supabase || !canManage) return;

    const { error } = await supabase.from("profiles").update({ role }).eq("id", person.id);
    if (error) {
      setNotice(error.message);
      return;
    }

    triggerSoftPulse();
    setNotice(`${person.full_name || "Employee"} role updated.`);
    refreshData();
  }

  async function approvePerson(person, role) {
    if (!supabase || !canManage) return;

    setLoading(true);
    const { error } = await supabase.from("profiles").update({ role, is_active: true, availability_status: "available" }).eq("id", person.id);
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    triggerSoftPulse();
    setNotice(`${profileDisplayName(person, "Employee")} approved as ${roleLabel(role)}.`);
    refreshData();
  }

  function editPerson(person) {
    if (person?.id === profile?.id && !canManage) {
      editMyProfile();
      return;
    }
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can edit employees.");
      return;
    }

    const [first = "", ...rest] = String(person.first_name || person.full_name || "").split(" ").filter(Boolean);
    setSelectedPersonId(person.id);
    setPersonForm({
      first_name: person.first_name || first,
      last_name: person.last_name || rest.join(" "),
      phone: person.phone || "",
      role: person.role || "builder",
      trade: person.trade || "",
      availability_status: person.availability_status || "available",
    });
    setModalType("personEdit");
  }

  async function savePerson(event) {
    event.preventDefault();
    if (!supabase || !canManage || !selectedPerson) return;

    const firstName = personForm.first_name.trim();
    const lastName = personForm.last_name.trim();
    const phone = personForm.phone.trim();
    if (!firstName || !lastName || !phone) {
      setNotice("First name, last name, and phone number are required.");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        phone,
        role: personForm.role,
        trade: personForm.trade.trim(),
        availability_status: personForm.availability_status,
      })
      .eq("id", selectedPerson.id);
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    triggerSoftPulse();
    setNotice("Employee profile saved.");
    setModalType(null);
    refreshData();
  }

  async function saveDeveloperSettings(event) {
    event.preventDefault();
    if (!supabase || !profile?.company_id || !canUseDeveloperMode) {
      setNotice("Developer mode is available to non-Builder roles only.");
      return;
    }

    const nextFlags = normalizeFeatureFlags({
      safetyForm: Boolean(developerForm.safetyForm),
      beforeAfterPhotos: Boolean(developerForm.beforeAfterPhotos),
      testBots: Boolean(developerForm.testBots),
    });
    const shouldCreateBots = nextFlags.testBots && !activeFeatureFlags.testBots;
    const shouldDeleteBots = !nextFlags.testBots && activeFeatureFlags.testBots;
    const parsedBotCount = Number.parseInt(developerForm.botCount, 10);
    const botCount = Math.max(1, Math.min(100, Number.isFinite(parsedBotCount) ? parsedBotCount : 0));
    const currentBotCount = (rowsSource.people ?? []).filter((person) => person.is_bot).length;
    const shouldSyncBots = nextFlags.testBots && (shouldCreateBots || currentBotCount !== botCount);

    if (nextFlags.testBots && shouldSyncBots && (!Number.isFinite(parsedBotCount) || parsedBotCount < 1)) {
      setNotice("Enter how many test bots to create.");
      return;
    }

    const previousFlags = featureFlags;
    setLoading(true);
    setFeatureFlags(nextFlags);
    setNotice("Saving developer mode...");
    try {
      const { error } = await supabase.from("companies").update({ feature_flags: nextFlags }).eq("id", profile.company_id);
      if (error) throw error;

      if (shouldDeleteBots) {
        const { error: deleteError } = await supabase.rpc("delete_test_bots");
        if (deleteError) throw deleteError;
      }

      if (shouldSyncBots) {
        const deleteResult = await supabase.rpc("delete_test_bots");
        if (deleteResult.error) throw deleteResult.error;
        const createResult = await supabase.rpc("create_test_bots", { bot_count: botCount });
        if (createResult.error) throw createResult.error;
      }

      triggerSoftPulse();
      setNotice(shouldSyncBots ? `${botCount} test bots ready.` : shouldDeleteBots ? "Test bots removed." : "Developer settings saved.");
      setModalType(null);
      refreshData();
    } catch (error) {
      setFeatureFlags(previousFlags);
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfileSettings(event) {
    event.preventDefault();
    if (!supabase || !profile) return;

    const firstName = profileForm.first_name.trim();
    const lastName = profileForm.last_name.trim();
    const phone = profileForm.phone.trim();
    if (!firstName || !lastName || !phone) {
      setNotice("First name, last name, and phone number are required.");
      return;
    }

    setLoading(true);
    setNotice("Saving profile...");
    try {
      let avatarPath = profile.avatar_path || null;
      if (profileForm.removeAvatar) avatarPath = null;
      if (profileForm.avatarFile) {
        avatarPath = await uploadProfileAvatar({ companyId: profile.company_id, profileId: profile.id, file: profileForm.avatarFile });
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          phone,
          avatar_path: avatarPath,
        })
        .eq("id", profile.id);

      if (error) throw error;
      triggerSoftPulse();
      setNotice("Profile saved.");
      setModalType(null);
      refreshData();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateVisitStatus(status) {
    if (!supabase || !currentVisit?.id) {
      setNotice("Sign in and select a live visit first.");
      return;
    }

    const patch =
      status === "on_site"
        ? { status, arrived_at: new Date().toISOString() }
        : { status, completed_at: new Date().toISOString() };
    const { error } = await supabase.from("visits").update(patch).eq("id", currentVisit.id);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice(status === "on_site" ? "Visit is in progress. Upload Safety Form and first-visit photos." : "Visit completed. Add photos and office notes.");
    loadVisits();
  }

  async function updateVisitStatusById(visitId, status, extra = {}) {
    if (!supabase || !visitId) {
      setNotice("Sign in and select a live visit first.");
      return false;
    }

    const patch =
      status === "on_site"
        ? { status, arrived_at: new Date().toISOString(), ...extra }
        : { status, completed_at: new Date().toISOString(), ...extra };
    const { error } = await supabase.from("visits").update(patch).eq("id", visitId);

    if (error) {
      setNotice(error.message);
      return false;
    }

    loadVisits();
    return true;
  }

  function getVisitFiles(visit) {
    return (rowsSource.files ?? []).filter((file) => visit?.id && file.visit_id === visit.id);
  }

  async function logVisitActivity(visit, activityType, message, metadata = {}) {
    if (!supabase || !profile || !visit?.id) return;
    const projectId = visit.project_id ?? selectedProject?.id;
    if (!projectId || !rowsSource.companyId) return;

    const { error } = await supabase.from("visit_activity").insert({
      company_id: rowsSource.companyId,
      project_id: projectId,
      visit_id: visit.id,
      actor_id: profile.id,
      activity_type: activityType,
      message,
      metadata,
    });

    if (error) setNotice(error.message);
  }

  async function uploadPhotosWithProgress({ files, captions, fileType, label, project, searchTextForFile, visit }) {
    let completed = 0;
    const rows = await Promise.all(
      files.map(async (file) => {
        const caption = captions?.[fileInputKey(file)]?.trim() || "";
        const row = await uploadVisitPhoto({
          companyId: rowsSource.companyId,
          projectId: project.id,
          visitId: visit.id,
          profileId: profile.id,
          file,
          fileType,
          photoCaption: caption,
          searchText: searchTextForFile(file, caption),
        });
        completed += 1;
        setUploadProgress({ current: completed, total: files.length, label });
        commitWorkspaceData((current) => ({ ...current, files: [row, ...(current.files ?? [])] }));
        return row;
      }),
    );

    return rows;
  }

  function showDetailOverlay(nextOverlay) {
    if (detailOverlay && detailOverlay !== nextOverlay) setDetailOverlayStack((stack) => [...stack, detailOverlay]);
    setDetailOverlay(nextOverlay);
  }

  function closeDetailOverlay() {
    setDetailOverlayStack((stack) => {
      const previous = stack.at(-1);
      setDetailOverlay(previous || "");
      return previous ? stack.slice(0, -1) : [];
    });
  }

  function clearDetailOverlay() {
    setDetailOverlay("");
    setDetailOverlayStack([]);
  }

  function openProjectOverlay(project, mode = "project") {
    setSelectedProjectId(project.id);
    if (mode === "project") {
      const nextVisit = (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === project.id)
        .sort((a, b) => `${b.visit_date} ${b.start_time}`.localeCompare(`${a.visit_date} ${a.start_time}`))[0];
      setSelectedVisitId(nextVisit?.id ?? "");
    }
    showDetailOverlay(mode);
  }

  function openVisitOverlay(visit) {
    if (!visit) return;
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);
    setSelectedDate(visit.visit_date);
    showDetailOverlay("visit");
  }

  function openPersonOverlay(person) {
    if (!person?.id) return;
    setSelectedPersonId(person.id);
    showDetailOverlay("person");
  }

  function openMyProfile() {
    if (!profile?.id) return;
    setIsAccountMenuOpen(false);
    setSelectedPersonId(profile.id);
    showDetailOverlay("person");
  }

  function editMyProfile() {
    if (!profile?.id) return;
    const [first = "", ...rest] = String(profile.first_name || profile.full_name || "").split(" ").filter(Boolean);
    setProfileForm({
      first_name: profile.first_name || first,
      last_name: profile.last_name || rest.join(" "),
      phone: profile.phone || "",
      avatarFile: null,
      removeAvatar: false,
    });
    setIsAccountMenuOpen(false);
    setModalType("profileEdit");
  }

  function openDeveloperMode() {
    if (!canUseDeveloperMode) {
      setNotice("Developer mode is available to Owner, PM, and Office Manager roles.");
      return;
    }
    setDeveloperForm({ ...normalizeFeatureFlags(featureFlags), botCount: "10" });
    setIsAccountMenuOpen(false);
    setModalType("developerMode");
  }

  function startArrivalWorkflow(visit = currentVisit) {
    if (!visit?.id) {
      setNotice("Select today's visit first.");
      return;
    }

    const files = getVisitFiles(visit);
    const safetyFiles = files.filter((file) => file.file_type === "safety_form");
    const currentProfileName = profileDisplayName(profile, "").toLowerCase();
    const currentProfileSignedSafety =
      !visit.people_ids?.includes(profile?.id) ||
      safetyFiles.some((file) => `${file.file_name || ""} ${file.search_text || ""}`.toLowerCase().includes(currentProfileName));
    const hasSafety = safetyFiles.length > 0 && currentProfileSignedSafety;
    const hasBefore = files.some((file) => file.file_type === "before_photo");

    setWorkflowVisitId(visit.id);
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);

    if (activeFeatureFlags.safetyForm && !hasSafety) {
      const assignedTeam = rowsSource.people.filter((person) => visit.people_ids?.includes(person.id));
      const team = safetyFiles.length > 0 && profile?.id ? assignedTeam.filter((person) => person.id === profile.id) : assignedTeam;
      setSafetyForm({
        hazards: [],
        notes: "",
        signatures: Object.fromEntries(team.map((person) => [person.id, ""])),
        presentIds: team.map((person) => person.id),
      });
      setModalType("safety");
      return;
    }

    if (activeFeatureFlags.beforeAfterPhotos && !hasBefore) {
      setPhotoStep({ kind: "before", visitId: visit.id, files: [], captions: {} });
      setModalType("beforePhotos");
      return;
    }

    updateVisitStatusById(visit.id, "on_site").then((updated) => {
      if (!updated) return;
      logVisitActivity(visit, "arrived", `${currentUserName} arrived and started work.`, {
        arrivedAt: new Date().toISOString(),
        skippedSafetyForm: !activeFeatureFlags.safetyForm,
        skippedBeforePhotos: !activeFeatureFlags.beforeAfterPhotos,
      });
    });
  }

  function startCompletionWorkflow(visit = currentVisit) {
    if (!visit?.id) {
      setNotice("Select an active visit first.");
      return;
    }

    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);
    setWorkflowVisitId(visit.id);
    setCompletionForm({ notes: "", files: [], captions: {} });
    setModalType("completeVisit");
  }

  async function saveSafetyForm(event) {
    event.preventDefault();
    const activeVisit = workflowVisit ?? currentVisit;
    const activeProject = workflowProject ?? selectedProject;
    if (!supabase || !profile || !activeVisit || !activeProject) {
      setNotice("Select a visit before saving the safety form.");
      return;
    }

    const assignedTeam = rowsSource.people.filter((person) => activeVisit.people_ids?.includes(person.id));
    const presentIds = new Set(safetyForm.presentIds?.length ? safetyForm.presentIds : assignedTeam.map((person) => person.id));
    const team = assignedTeam.filter((person) => presentIds.has(person.id));
    const absentTeam = assignedTeam.filter((person) => !presentIds.has(person.id));
    const missingSignature = team.some((person) => !safetyForm.signatures[person.id]?.trim());
    if (safetyForm.hazards.length === 0 || team.length === 0 || missingSignature) {
      setNotice("Confirm who is on site, select hazards, and collect every present team member signature before continuing.");
      return;
    }

    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const names = team.map((person) => person.full_name || person.email || "Team member");
      const signedAt = new Date();
      const safetyLetterhead = await imageUrlToDataUrl(`${import.meta.env.BASE_URL}samsom-industries-letterhead.png`);
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      doc.setFillColor(17, 24, 39);
      doc.rect(0, 0, 612, 92, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("BuildCore Construction", 42, 42);
      doc.setFontSize(13);
      doc.text("Digital Safety Form", 42, 66);
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(15);
      doc.text(doc.splitTextToSize(activeProject.name, 320), 42, 126);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Job Number: ${activeProject.job_number || "Not set"}`, 42, 154);
      doc.text(doc.splitTextToSize(`Address: ${activeProject.address}`, 492), 42, 170);
      doc.text(`Visit Date: ${formatDateLabel(activeVisit.visit_date)}`, 42, 196);
      doc.text(`Current Time: ${formatTimeLabel(`${signedAt.getHours()}:${signedAt.getMinutes()}`)}`, 220, 196);
      doc.text(`Scheduled Time: ${formatTimeRange(activeVisit.start_time, activeVisit.end_time)}`, 398, 196);

      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(42, 244, 528, 112, 8, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Potential Hazards", 58, 270);
      doc.setFont("helvetica", "normal");
      const hazards = doc.splitTextToSize(safetyForm.hazards.join(", "), 492);
      doc.text(hazards, 58, 292);

      doc.setFont("helvetica", "bold");
      doc.text("Notes", 58, 336);
      doc.setFont("helvetica", "normal");
      doc.text(doc.splitTextToSize(safetyForm.notes || "None", 430), 100, 336);

      let y = 398;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Team Signatures", 42, y);
      y += 24;
      if (absentTeam.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(doc.splitTextToSize(`Not on site for this form: ${absentTeam.map((person) => person.full_name || person.email || "Team member").join(", ")}`, 492), 42, y);
        y += 34;
      }
      team.forEach((person) => {
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(42, y, 528, 82, 8, 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(person.full_name || person.email || "Team member", 58, y + 24);
        doc.setFont("helvetica", "normal");
        doc.text(`Signed: ${formatDateTimeLabel(signedAt)}`, 58, y + 42);
        doc.addImage(safetyForm.signatures[person.id], "PNG", 320, y + 12, 190, 48);
        y += 96;
      });
      doc.addImage(safetyLetterhead, "PNG", 332, 650, 238, 105);

      const blob = doc.output("blob");
      const searchableText = [
        activeProject.name,
        activeProject.job_number,
        activeProject.address,
        formatDateLabel(activeVisit.visit_date),
        formatDateTimeLabel(signedAt),
        safetyForm.hazards.join(", "),
        safetyForm.notes,
        ...names,
        ...absentTeam.map((person) => person.full_name || person.email || "Team member"),
      ].join(" ");
      const fileName = `${names.join("-")}-${activeVisit.visit_date}-safety-form.pdf`.replace(/\s+/g, "-");
      setNotice("Saving Safety PDF to Supabase Storage...");
      await uploadVisitGeneratedFile({
        companyId: rowsSource.companyId,
        projectId: activeProject.id,
        visitId: activeVisit.id,
        profileId: profile.id,
        blob,
        fileName,
        fileType: "safety_form",
        searchText: searchableText,
      });
      await logVisitActivity(activeVisit, "safety_form_saved", `${currentUserName} saved the digital safety form.`, {
        hazards: safetyForm.hazards,
        team: names,
        absentTeam: absentTeam.map((person) => person.full_name || person.email || "Team member"),
      });

      if (!activeFeatureFlags.beforeAfterPhotos) {
        await updateVisitStatusById(activeVisit.id, "on_site");
        await logVisitActivity(activeVisit, "arrived", `${currentUserName} arrived and started work.`, {
          arrivedAt: new Date().toISOString(),
          skippedBeforePhotos: true,
        });
        setModalType(null);
        setWorkflowVisitId("");
        setSafetyForm({ hazards: [], notes: "", signatures: {}, presentIds: [] });
        triggerSoftPulse();
        setNotice("Safety form saved. Work started.");
        loadVisits();
        loadActivities();
        loadFiles();
        return;
      }

      setWorkflowVisitId(activeVisit.id);
      setPhotoStep({ kind: "before", visitId: activeVisit.id, files: [], captions: {} });
      setModalType("beforePhotos");
      setNotice("Safety form saved. Add before photos to start work.");
      loadFiles();
      loadActivities();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveBeforePhotos(event) {
    event.preventDefault();
    const activeVisit = (rowsSource.visits ?? []).find((visit) => visit.id === photoStep.visitId) ?? workflowVisit ?? currentVisit;
    const activeProject = activeVisit ? rowsSource.projects.find((project) => project.id === activeVisit.project_id) ?? workflowProject ?? selectedProject : workflowProject ?? selectedProject;
    if (!supabase || !profile || !activeVisit || !activeProject) {
      setNotice("Select a visit before uploading photos.");
      return;
    }
    if (photoStep.files.length === 0) {
      setNotice("Upload at least one before photo.");
      return;
    }

    setLoading(true);
    try {
      setNotice(`Uploading ${photoStep.files.length} before photo${photoStep.files.length === 1 ? "" : "s"}...`);
      setUploadProgress({ current: 0, total: photoStep.files.length, label: "Before photos" });
      await uploadPhotosWithProgress({
        captions: photoStep.captions,
        fileType: "before_photo",
        files: photoStep.files,
        label: "Before photos",
        project: activeProject,
        visit: activeVisit,
        searchTextForFile: (_file, caption) => `Before photo uploaded by ${currentUserName} at ${new Date().toISOString()}. ${caption}`,
      });
      await logVisitActivity(activeVisit, "before_photos_uploaded", `${currentUserName} uploaded ${photoStep.files.length} before photo${photoStep.files.length === 1 ? "" : "s"}.`, {
        count: photoStep.files.length,
      });
      await updateVisitStatusById(activeVisit.id, "on_site");
      await logVisitActivity(activeVisit, "arrived", `${currentUserName} arrived and started work.`, {
        arrivedAt: new Date().toISOString(),
      });
      setModalType(null);
      setWorkflowVisitId("");
      setPhotoStep({ kind: "", visitId: "", files: [], captions: {} });
      triggerSoftPulse();
      setNotice("Work started. Ticket is Active.");
      loadVisits();
      loadActivities();
      loadFiles();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploadProgress(null);
      setLoading(false);
    }
  }

  async function saveCompletion(event) {
    event.preventDefault();
    const activeVisit = workflowVisit ?? currentVisit;
    const activeProject = workflowProject ?? selectedProject;
    if (!supabase || !profile || !activeVisit || !activeProject) {
      setNotice("Select a visit before completing work.");
      return;
    }
    if (activeFeatureFlags.beforeAfterPhotos && completionForm.files.length === 0) {
      setNotice("Upload at least one after photo before completing work.");
      return;
    }

    setLoading(true);
    try {
      if (completionForm.files.length > 0) {
        setNotice(`Uploading ${completionForm.files.length} after photo${completionForm.files.length === 1 ? "" : "s"}...`);
        setUploadProgress({ current: 0, total: completionForm.files.length, label: "After photos" });
        await uploadPhotosWithProgress({
          captions: completionForm.captions,
          fileType: "completion_photo",
          files: completionForm.files,
          label: "After photos",
          project: activeProject,
          visit: activeVisit,
          searchTextForFile: (_file, caption) => `After photo uploaded by ${currentUserName} at ${new Date().toISOString()}. ${completionForm.notes} ${caption}`,
        });
        await logVisitActivity(activeVisit, "after_photos_uploaded", `${currentUserName} uploaded ${completionForm.files.length} after photo${completionForm.files.length === 1 ? "" : "s"}.`, {
          count: completionForm.files.length,
        });
      }
      await updateVisitStatusById(activeVisit.id, "completed", { completion_notes: completionForm.notes });
      await logVisitActivity(activeVisit, "completed", `${currentUserName} completed the visit.`, {
        completedAt: new Date().toISOString(),
        notes: completionForm.notes,
        skippedAfterPhotos: !activeFeatureFlags.beforeAfterPhotos,
      });
      setModalType(null);
      setWorkflowVisitId("");
      setCompletionForm({ notes: "", files: [], captions: {} });
      triggerSoftPulse();
      setNotice("Thank you. Work is Done.");
      loadVisits();
      loadActivities();
      loadFiles();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setUploadProgress(null);
      setLoading(false);
    }
  }

  async function deleteVisit(visitToDelete = currentVisit) {
    if (!supabase || !visitToDelete?.id || !canDeleteTickets) {
      setNotice("Select a live visit and sign in with a non-Builder role.");
      return;
    }

    const project = rowsSource.projects.find((item) => item.id === visitToDelete.project_id) ?? selectedProject;
    const confirmed = await confirmAction({
      title: "Remove ticket?",
      message: `Remove ticket for "${project?.name ?? "Project"}" on ${formatDateLabel(visitToDelete.visit_date)}? This will also remove its Activity Feed history.`,
      confirmLabel: "Remove ticket",
      danger: true,
    });
    if (!confirmed) return;

    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).filter((visit) => visit.id !== visitToDelete.id),
      activities: (current.activities ?? []).filter((activity) => activity.visit_id !== visitToDelete.id),
      files: (current.files ?? []).filter((file) => file.visit_id !== visitToDelete.id),
    }));
    const { error } = await supabase.from("visits").delete().eq("id", visitToDelete.id);
    if (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      return;
    }

    setSelectedAssignmentId("");
    if (selectedVisitId === visitToDelete.id) setSelectedVisitId("");
    if (workflowVisitId === visitToDelete.id) setWorkflowVisitId("");
    if (photoStep.visitId === visitToDelete.id) setPhotoStep({ kind: "", visitId: "", files: [], captions: {} });
    if (detailOverlay === "visit") closeDetailOverlay();
    triggerSoftPulse();
    setNotice("Ticket and Activity Feed removed.");
  }

  async function moveVisitAssignment({ assignment, row, clientX, trackElement }) {
    if (!supabase || !canManage) {
      setNotice("Sign in as Owner, PM, or Office Manager to move schedule items.");
      return;
    }
    if (!assignment?.visitId || !trackElement) return;
    if (row.kind !== "project" && assignment.type !== row.kind) {
      setNotice("Drop tickets on matching rows.");
      return;
    }

    const rect = trackElement.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = Math.max(0.25, assignment.end - assignment.start);
    const rawStart = scheduleStartHour + percent * (scheduleEndHour - scheduleStartHour);
    const start = Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, Math.round(rawStart * 4) / 4));
    const end = start + duration;
    const nextStartTime = toTimeValue(start);
    const nextEndTime = toTimeValue(end);
    const previousData = data;

    setNotice("Updating schedule...");
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((visit) => {
        if (visit.id !== assignment.visitId) return visit;
        const nextVisit = {
          ...visit,
          start_time: nextStartTime,
          end_time: nextEndTime,
        };

        if (row.kind === "person" && row.id !== assignment.resourceId) {
          const peopleIds = new Set(nextVisit.people_ids ?? []);
          peopleIds.add(row.id);
          if (assignment.type === "person") peopleIds.delete(assignment.resourceId);
          nextVisit.people_ids = [...peopleIds];
        }

        if (row.kind === "equipment" && row.id !== assignment.resourceId) {
          const equipmentIds = new Set(nextVisit.equipment_ids ?? []);
          equipmentIds.add(row.id);
          if (assignment.type === "equipment") equipmentIds.delete(assignment.resourceId);
          nextVisit.equipment_ids = [...equipmentIds];
        }

        return nextVisit;
      }),
    }));

    setLoading(true);
    let addedNewResource = false;

    if (row.kind !== "project" && row.id !== assignment.resourceId) {
      if (row.kind === "person") {
        const addResult = await supabase.from("visit_people").insert({ visit_id: assignment.visitId, profile_id: row.id });
        if (addResult.error) {
          commitWorkspaceData(previousData);
          setLoading(false);
          setNotice(addResult.error.message);
          loadVisits();
          return;
        }
        addedNewResource = true;
      } else {
        const addResult = await supabase.from("visit_equipment").insert({ visit_id: assignment.visitId, equipment_id: row.id });
        if (addResult.error) {
          commitWorkspaceData(previousData);
          setLoading(false);
          setNotice(addResult.error.message);
          loadVisits();
          return;
        }
        addedNewResource = true;
      }
    }

    const visitResult = await supabase
      .from("visits")
      .update({
        start_time: nextStartTime,
        end_time: nextEndTime,
      })
      .eq("id", assignment.visitId);

    if (visitResult.error) {
      commitWorkspaceData(previousData);
      if (addedNewResource) {
        if (row.kind === "person") await supabase.from("visit_people").delete().eq("visit_id", assignment.visitId).eq("profile_id", row.id);
        else await supabase.from("visit_equipment").delete().eq("visit_id", assignment.visitId).eq("equipment_id", row.id);
      }
      setLoading(false);
      setNotice(visitResult.error.message);
      loadVisits();
      return;
    }

    if (addedNewResource) {
      const removeResult =
        row.kind === "person"
          ? await supabase.from("visit_people").delete().eq("visit_id", assignment.visitId).eq("profile_id", assignment.resourceId)
          : await supabase.from("visit_equipment").delete().eq("visit_id", assignment.visitId).eq("equipment_id", assignment.resourceId);

      if (removeResult.error) {
        commitWorkspaceData(previousData);
        setLoading(false);
        setNotice(removeResult.error.message);
        loadVisits();
        return;
      }
    }

    setLoading(false);
    triggerSoftPulse();
    setNotice(`Visit moved to ${formatTimeRange(nextStartTime, nextEndTime)}.`);
    loadVisits();
  }

  async function assignPersonToVisit({ personId, sourceVisitId = "", visitId }) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can assign people.");
      return;
    }
    if (!personId || !visitId) return;

    const visit = (rowsSource.visits ?? []).find((item) => item.id === visitId);
    const person = rowsSource.people.find((item) => item.id === personId);
    if (!visit || !person) return;
    if (person.availability_status === "not_available") {
      setNotice(`${profileDisplayName(person)} is marked Not Available.`);
      return;
    }
    if (visit.people_ids?.includes(personId)) {
      setNotice(`${profileDisplayName(person)} is already assigned to this ticket.`);
      return;
    }

    const conflicts = (rowsSource.visits ?? []).filter((item) => {
      if (item.id === visitId || item.status === "cancelled") return false;
      if (item.visit_date !== visit.visit_date || !item.people_ids?.includes(personId)) return false;
      return overlaps(
        String(visit.start_time).slice(0, 5),
        String(visit.end_time).slice(0, 5),
        String(item.start_time).slice(0, 5),
        String(item.end_time).slice(0, 5),
      );
    });
    const conflictsText = conflicts
      .map((item) => {
        const project = rowsSource.projects.find((projectItem) => projectItem.id === item.project_id);
        return `${project?.name || "another project"} (${formatTimeRange(item.start_time, item.end_time)})`;
      })
      .join(", ");
    if (conflicts.length > 0 && !sourceVisitId) {
      setNotice(`${profileDisplayName(person)} already has an overlapping ticket: ${conflictsText}.`);
      return;
    }
    if (conflicts.length > 0) {
      const confirmed = await confirmAction({
        title: "Move crew member?",
        message: `${profileDisplayName(person)} is already assigned during this time: ${conflictsText}. Move them to this ticket instead?`,
        confirmLabel: "Move",
        danger: false,
      });
      if (!confirmed) {
        setNotice("Assignment unchanged.");
        return;
      }
    }

    const conflictVisitIds = conflicts.map((item) => item.id);
    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) => {
        if (conflictVisitIds.includes(item.id)) {
          return { ...item, people_ids: (item.people_ids ?? []).filter((id) => id !== personId) };
        }
        if (item.id !== visitId) return item;
        const peopleIds = new Set(item.people_ids ?? []);
        peopleIds.add(personId);
        return { ...item, people_ids: [...peopleIds] };
      }),
    }));
    setNotice(conflicts.length > 0 ? `Moving ${profileDisplayName(person)}...` : `Assigning ${profileDisplayName(person)}...`);
    setLoading(true);
    try {
      if (conflictVisitIds.length > 0) {
        const removeResult = await supabase.from("visit_people").delete().eq("profile_id", personId).in("visit_id", conflictVisitIds);
        if (removeResult.error) throw removeResult.error;
      }
      const { error } = await supabase.from("visit_people").insert({ visit_id: visitId, profile_id: personId });
      if (error) {
        if (conflictVisitIds.length > 0) {
          await supabase.from("visit_people").insert(conflictVisitIds.map((conflictVisitId) => ({ visit_id: conflictVisitId, profile_id: personId })));
        }
        throw error;
      }
      await Promise.all([
        ...conflicts.map((conflictVisit) =>
          logVisitActivity(conflictVisit, "person_removed", `${currentUserName} moved ${profileDisplayName(person)} from this ticket.`, { personId, movedToVisitId: visitId }),
        ),
        logVisitActivity(visit, "person_assigned", `${currentUserName} assigned ${profileDisplayName(person)} to this ticket.`, { personId, sourceVisitId, replacedVisitIds: conflictVisitIds }),
      ]);
      triggerSoftPulse();
      setNotice(conflicts.length > 0 ? `${profileDisplayName(person)} moved to ticket.` : `${profileDisplayName(person)} assigned to ticket.`);
      loadVisits();
      loadActivities();
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      loadVisits();
    } finally {
      setLoading(false);
    }
  }

  async function assignPeopleGroupToVisit({ personIds = [], visitId }) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can assign people.");
      return;
    }

    const visit = (rowsSource.visits ?? []).find((item) => item.id === visitId);
    if (!visit || personIds.length === 0) return;

    const conflictIds = getOverlappingPersonIds({ personIds, targetVisit: visit, visits: rowsSource.visits ?? [] });
    const eligiblePeople = rowsSource.people.filter((person) => personIds.includes(person.id) && person.availability_status !== "not_available" && !visit.people_ids?.includes(person.id) && !conflictIds.has(person.id));
    const skippedCount = Math.max(0, personIds.length - eligiblePeople.length);
    if (eligiblePeople.length === 0) {
      setNotice(skippedCount > 0 ? "Everyone in this group is unavailable or already scheduled for this time." : "No available people in this group.");
      return;
    }

    const previousData = data;
    const eligibleIds = eligiblePeople.map((person) => person.id);
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) => {
        if (item.id !== visitId) return item;
        return { ...item, people_ids: [...new Set([...(item.people_ids ?? []), ...eligibleIds])] };
      }),
    }));

    setNotice(`Assigning ${eligiblePeople.length} people...`);
    setLoading(true);
    try {
      const { error } = await supabase.from("visit_people").insert(eligibleIds.map((profileId) => ({ visit_id: visitId, profile_id: profileId })));
      if (error) throw error;
      await logVisitActivity(visit, "people_group_assigned", `${currentUserName} assigned ${eligiblePeople.length} people to this ticket.`, { personIds: eligibleIds });
      triggerSoftPulse();
      setNotice(skippedCount > 0 ? `${eligiblePeople.length} people assigned. ${skippedCount} skipped.` : `${eligiblePeople.length} people assigned to ticket.`);
      loadVisits();
      loadActivities();
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      loadVisits();
    } finally {
      setLoading(false);
    }
  }

  async function assignEquipmentToVisit({ equipmentId, sourceVisitId = "", visitId }) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can assign equipment.");
      return;
    }
    if (!equipmentId || !visitId) return;

    const visit = (rowsSource.visits ?? []).find((item) => item.id === visitId);
    const equipment = rowsSource.equipment.find((item) => item.id === equipmentId);
    if (!visit || !equipment) return;
    if (visit.equipment_ids?.includes(equipmentId)) {
      setNotice(`${equipment.name} is already assigned to this ticket.`);
      return;
    }

    const conflicts = (rowsSource.visits ?? []).filter((item) => {
      if (item.id === visitId || item.status === "cancelled") return false;
      if (item.visit_date !== visit.visit_date || !item.equipment_ids?.includes(equipmentId)) return false;
      return overlaps(
        String(visit.start_time).slice(0, 5),
        String(visit.end_time).slice(0, 5),
        String(item.start_time).slice(0, 5),
        String(item.end_time).slice(0, 5),
      );
    });
    const conflictsText = conflicts
      .map((item) => {
        const project = rowsSource.projects.find((projectItem) => projectItem.id === item.project_id);
        return `${project?.name || "another project"} (${formatTimeRange(item.start_time, item.end_time)})`;
      })
      .join(", ");

    if (conflicts.length > 0 && !sourceVisitId) {
      setNotice(`${equipment.name} already has an overlapping ticket: ${conflictsText}.`);
      return;
    }
    if (conflicts.length > 0) {
      const confirmed = await confirmAction({
        title: "Move equipment?",
        message: `${equipment.name} is already assigned during this time: ${conflictsText}. Move it to this ticket instead?`,
        confirmLabel: "Move",
        danger: false,
      });
      if (!confirmed) {
        setNotice("Equipment assignment unchanged.");
        return;
      }
    }

    const conflictVisitIds = conflicts.map((item) => item.id);
    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) => {
        if (conflictVisitIds.includes(item.id)) {
          return { ...item, equipment_ids: (item.equipment_ids ?? []).filter((id) => id !== equipmentId) };
        }
        if (item.id !== visitId) return item;
        return { ...item, equipment_ids: [...new Set([...(item.equipment_ids ?? []), equipmentId])] };
      }),
    }));

    setNotice(conflicts.length > 0 ? `Moving ${equipment.name}...` : `Assigning ${equipment.name}...`);
    setLoading(true);
    try {
      if (conflictVisitIds.length > 0) {
        const removeResult = await supabase.from("visit_equipment").delete().eq("equipment_id", equipmentId).in("visit_id", conflictVisitIds);
        if (removeResult.error) throw removeResult.error;
      }
      const { error } = await supabase.from("visit_equipment").insert({ visit_id: visitId, equipment_id: equipmentId });
      if (error) {
        if (conflictVisitIds.length > 0) {
          await supabase.from("visit_equipment").insert(conflictVisitIds.map((conflictVisitId) => ({ visit_id: conflictVisitId, equipment_id: equipmentId })));
        }
        throw error;
      }
      await Promise.all([
        ...conflicts.map((conflictVisit) =>
          logVisitActivity(conflictVisit, "equipment_removed", `${currentUserName} moved ${equipment.name} from this ticket.`, { equipmentId, movedToVisitId: visitId }),
        ),
        logVisitActivity(visit, "equipment_assigned", `${currentUserName} assigned ${equipment.name} to this ticket.`, { equipmentId, sourceVisitId, replacedVisitIds: conflictVisitIds }),
      ]);
      triggerSoftPulse();
      setNotice(conflicts.length > 0 ? `${equipment.name} moved to ticket.` : `${equipment.name} assigned to ticket.`);
      loadVisits();
      loadActivities();
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      loadVisits();
    } finally {
      setLoading(false);
    }
  }

  async function removePersonFromVisit({ personId, visitId }) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can change ticket crews.");
      return;
    }
    if (!personId || !visitId) return;

    const visit = (rowsSource.visits ?? []).find((item) => item.id === visitId);
    const person = rowsSource.people.find((item) => item.id === personId);
    if (!visit || !person) return;
    if (!visit.people_ids?.includes(personId)) return;
    const project = rowsSource.projects.find((item) => item.id === visit.project_id);
    const confirmed = await confirmAction({
      title: "Remove from ticket?",
      message: `Remove ${profileDisplayName(person)} from ${project?.name || "this ticket"}?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) {
      setNotice("Crew assignment unchanged.");
      return;
    }

    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) => {
        if (item.id !== visitId) return item;
        return { ...item, people_ids: (item.people_ids ?? []).filter((id) => id !== personId) };
      }),
    }));
    setNotice(`Removing ${profileDisplayName(person)}...`);
    setLoading(true);
    try {
      const { error } = await supabase.from("visit_people").delete().eq("visit_id", visitId).eq("profile_id", personId);
      if (error) throw error;
      await logVisitActivity(visit, "person_removed", `${currentUserName} removed ${profileDisplayName(person)} from this ticket.`, { personId });
      triggerSoftPulse();
      setNotice(`${profileDisplayName(person)} removed from ticket.`);
      loadVisits();
      loadActivities();
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      loadVisits();
    } finally {
      setLoading(false);
    }
  }

  async function openAddModal() {
    if (!session) {
      setNotice("Sign in first.");
      return;
    }
    if (!profile) {
      setModalType("onboarding");
      return;
    }
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can add records.");
      return;
    }

    if (activeNav === "projects") {
      if (!(await acquireEditLock({ mode: "create", resourceType: "project" }))) return;
      setEditingProjectId(null);
      const nextProjectForm = { ...emptyProjectForm, manager_id: profile.id };
      setProjectForm(nextProjectForm);
      editorInitialSnapshotRef.current.project = serializeProjectEditorForm(nextProjectForm);
      setModalType("project");
    } else if (activeNav === "equipment") {
      setEditingEquipmentId(null);
      setEquipmentForm(emptyEquipmentForm);
      setModalType("equipment");
    }
    else if (activeNav === "people") setModalType("people");
    else {
      if (!(await acquireEditLock({ mode: "create", resourceType: "visit" }))) return;
      setEditingVisitId(null);
      const nextVisitForm = {
        ...emptyVisitForm,
        visit_date: selectedDate,
        project_id: selectedProject?.id ?? rowsSource.projects[0]?.id ?? "",
      };
      setVisitForm(nextVisitForm);
      editorInitialSnapshotRef.current.visit = serializeVisitEditorForm(nextVisitForm);
      setModalType("visit");
    }
  }

  async function removeEquipmentFromVisit({ equipmentId, visitId }) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can change ticket equipment.");
      return;
    }
    if (!equipmentId || !visitId) return;

    const visit = (rowsSource.visits ?? []).find((item) => item.id === visitId);
    const equipment = rowsSource.equipment.find((item) => item.id === equipmentId);
    if (!visit || !equipment || !visit.equipment_ids?.includes(equipmentId)) return;
    const project = rowsSource.projects.find((item) => item.id === visit.project_id);
    const confirmed = await confirmAction({
      title: "Remove equipment?",
      message: `Remove ${equipment.name} from ${project?.name || "this ticket"}?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) {
      setNotice("Equipment assignment unchanged.");
      return;
    }

    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) => {
        if (item.id !== visitId) return item;
        return { ...item, equipment_ids: (item.equipment_ids ?? []).filter((id) => id !== equipmentId) };
      }),
    }));

    setLoading(true);
    try {
      const { error } = await supabase.from("visit_equipment").delete().eq("visit_id", visitId).eq("equipment_id", equipmentId);
      if (error) throw error;
      await logVisitActivity(visit, "equipment_removed", `${currentUserName} removed ${equipment.name} from this ticket.`, { equipmentId });
      triggerSoftPulse();
      setNotice(`${equipment.name} removed from ticket.`);
      loadVisits();
      loadActivities();
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      loadVisits();
    } finally {
      setLoading(false);
    }
  }

  async function openVisitModal(projectId = selectedProject?.id) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can schedule visits.");
      return;
    }
    if (!(await acquireEditLock({ mode: "create", resourceType: "visit" }))) return;

    setEditingVisitId(null);
    const nextVisitForm = {
      ...emptyVisitForm,
      visit_date: selectedDate,
      project_id: projectId ?? "",
    };
    setVisitForm(nextVisitForm);
    editorInitialSnapshotRef.current.visit = serializeVisitEditorForm(nextVisitForm);
    setModalType("visit");
  }

  function editEquipment(item) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can edit equipment.");
      return;
    }
    setEditingEquipmentId(item.id);
    setEquipmentForm({
      name: item.name ?? "",
      type: item.type ?? "",
      unit_number: item.unit_number ?? "",
      notes: item.notes ?? "",
      avatar_key: getEquipmentAvatarOption(item).key,
    });
    setModalType("equipment");
  }

  function selectProject(project) {
    setSelectedAssignmentId("");
    openProjectOverlay(project, "project");
  }

  function selectAssignment(assignment) {
    setSelectedAssignmentId(assignment.id);
    const visit = rowsSource.visits.find((item) => item.id === assignment.visitId);
    if (visit) openVisitOverlay(visit);
    else {
      setSelectedProjectId(assignment.projectId);
      setSelectedVisitId(assignment.visitId ?? "");
      showDetailOverlay("visit");
    }
  }

  async function editVisit(visit) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can edit visits.");
      return;
    }
    if (!(await acquireEditLock({ mode: "edit", resourceId: visit.id, resourceType: "visit" }))) return;

    setEditingVisitId(visit.id);
    const nextVisitForm = {
      project_id: visit.project_id ?? selectedProject?.id ?? "",
      visit_date: visit.visit_date ?? selectedDate,
      duration_days: "1",
      start_time: String(visit.start_time ?? "07:00").slice(0, 5),
      end_time: String(visit.end_time ?? "17:00").slice(0, 5),
      work_scope: visit.work_scope ?? "",
      work_scopes: [visit.work_scope ?? ""],
      is_first_visit: Boolean(visit.is_first_visit),
      people_ids: visit.people_ids ?? [],
      equipment_ids: visit.equipment_ids ?? [],
    };
    setVisitForm(nextVisitForm);
    editorInitialSnapshotRef.current.visit = serializeVisitEditorForm(nextVisitForm);
    setSelectedVisitId(visit.id);
    setModalType("visit");
  }

  async function openAttachment(attachment) {
    try {
      const urls = attachment.viewUrl ? attachment : await createAttachmentUrls(attachment);
      const opened = { ...attachment, ...urls };
      const isPhoto = opened.file_kind === "photo" || opened.mime_type?.startsWith("image/");

      if (isPhoto) {
        const siblingPhotos = (rowsSource.files ?? [])
          .filter((file) => (file.file_kind === "photo" || file.mime_type?.startsWith("image/")) && file.project_id === opened.project_id && (opened.visit_id ? file.visit_id === opened.visit_id : !file.visit_id))
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        const hydrated = await Promise.all(
          siblingPhotos.map(async (file) => {
            if (file.id === opened.id) return opened;
            const nextUrls = await createAttachmentUrls(file);
            return { ...file, ...nextUrls };
          }),
        );
        setViewerItems(hydrated);
        setPhotoZoom(1);
        setIsAnnotatingPhoto(false);
      } else {
        setViewerItems([]);
      }

      setSelectedAttachment(opened);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function annotateSelectedAttachment({ dataUrl, annotationJson }) {
    if (!selectedAttachment || !profile) return;
    setLoading(true);
    try {
      const saved = await replaceVisitPhotoWithAnnotation({
        attachment: selectedAttachment,
        dataUrl,
        annotationJson,
        actorId: profile.id,
      });
      const urls = await createAttachmentUrls(saved);
      const updated = { ...saved, ...urls };
      setSelectedAttachment(updated);
      setViewerItems((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      commitWorkspaceData((current) => ({
        ...current,
        files: (current.files ?? []).map((file) => (file.id === updated.id ? updated : file)),
      }));
      const visit = (rowsSource.visits ?? []).find((item) => item.id === saved.visit_id);
      await logVisitActivity(visit, "photo_annotated", `${currentUserName} annotated ${saved.file_name}.`, { fileId: saved.id });
      await loadFiles();
      await loadActivities();
      setIsAnnotatingPhoto(false);
      triggerSoftPulse();
      setNotice("Annotation saved and original photo replaced.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeSelectedAttachment() {
    if (!selectedAttachment) return;
    const confirmed = await confirmAction({
      title: "Delete file?",
      message: `Delete "${selectedAttachment.file_name || "photo"}"?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    setLoading(true);
    try {
      const removed = selectedAttachment;
      await deleteVisitFile(removed);
      const visit = (rowsSource.visits ?? []).find((item) => item.id === removed.visit_id);
      await logVisitActivity(visit, "file_deleted", `${currentUserName} deleted ${removed.file_name}.`, { fileId: removed.id });
      const nextItems = viewerItems.filter((item) => item.id !== removed.id);
      setViewerItems(nextItems);
      setSelectedAttachment(nextItems[0] ?? null);
      commitWorkspaceData((current) => ({
        ...current,
        files: (current.files ?? []).filter((file) => file.id !== removed.id),
      }));
      await loadFiles();
      await loadActivities();
      triggerSoftPulse();
      setNotice("File deleted.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function downloadAttachment(attachment) {
    try {
      const urls = attachment.viewUrl ? attachment : await createAttachmentUrls(attachment);
      if (!urls.viewUrl) throw new Error("Download link is not available.");

      const link = document.createElement("a");
      link.href = urls.viewUrl;
      link.download = attachment.file_name || "download";
      link.rel = "noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      setNotice(`Downloading ${attachment.file_name || "file"}...`);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function hydrateExportFiles(files = []) {
    return Promise.all(
      files.map(async (file) => {
        try {
          return { ...file, ...(file.viewUrl ? {} : await createAttachmentUrls(file)) };
        } catch {
          return file;
        }
      }),
    );
  }

  async function exportCurrentProjectPdf(project = selectedProject) {
    if (!project) return;
    setLoading(true);
    setNotice("Preparing project PDF...");
    try {
      const { exportProjectPdf } = await import("./lib/exporters.js");
      const visits = (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === project.id)
        .sort((a, b) => `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`));
      const files = await hydrateExportFiles((rowsSource.files ?? []).filter((file) => file.project_id === project.id));
      const activities = (rowsSource.activities ?? []).filter((item) => item.project_id === project.id);
      await exportProjectPdf({ project, visits, files, activities, people: rowsSource.people, equipment: rowsSource.equipment, getProfileName });
      setNotice("Project PDF exported.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportCurrentVisitPdf(visit = currentVisit) {
    if (!visit) return;
    const project = rowsSource.projects.find((item) => item.id === visit.project_id) ?? selectedProject;
    setLoading(true);
    setNotice("Preparing ticket PDF...");
    try {
      const { exportVisitPdf } = await import("./lib/exporters.js");
      const files = await hydrateExportFiles((rowsSource.files ?? []).filter((file) => file.visit_id === visit.id));
      const activities = (rowsSource.activities ?? []).filter((item) => item.visit_id === visit.id);
      await exportVisitPdf({
        visit,
        project,
        files,
        activities,
        people: rowsSource.people.filter((person) => visit.people_ids?.includes(person.id)),
        equipment: rowsSource.equipment.filter((item) => visit.equipment_ids?.includes(item.id)),
        getProfileName,
      });
      setNotice("Ticket PDF exported.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportAllProjectsToExcel() {
    setLoading(true);
    setNotice("Preparing projects Excel...");
    try {
      const { exportProjectsXlsx } = await import("./lib/exporters.js");
      exportProjectsXlsx(rowsSource.projects, getProfileName);
      setNotice("Projects Excel exported.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportProjectTicketsToExcel(project = selectedProject) {
    if (!project) return;
    setLoading(true);
    setNotice("Preparing tickets Excel...");
    try {
      const { exportProjectTicketsXlsx } = await import("./lib/exporters.js");
      const visits = (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === project.id)
        .sort((a, b) => `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`));
      exportProjectTicketsXlsx({ project, visits, people: rowsSource.people, equipment: rowsSource.equipment, getProfileName });
      setNotice("Project tickets Excel exported.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteActivityItem(item) {
    if (!supabase || !item?.id || !canDeleteTickets) {
      setNotice("Only non-Builder users can delete Activity Feed rows.");
      return;
    }
    const confirmed = await confirmAction({
      title: "Delete Activity Feed row?",
      message: "This removes the selected history row from the project and ticket.",
      confirmLabel: "Delete row",
      danger: true,
    });
    if (!confirmed) return;
    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      activities: (current.activities ?? []).filter((activity) => activity.id !== item.id),
    }));
    setLoading(true);
    try {
      const { data: deletedRows, error } = await supabase.from("visit_activity").delete().eq("id", item.id).select("id");
      if (error) throw error;
      if (!deletedRows?.length) throw new Error("Activity Feed row was not deleted. Check Supabase delete policy.");
      triggerSoftPulse();
      setNotice("Activity Feed row deleted.");
      loadActivities();
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      loadActivities();
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSelect(result) {
    if (result.type === "project") {
      const project = rowsSource.projects.find((item) => item.id === result.id.replace("project-", ""));
      if (project) openProjectOverlay(project, "project");
      setActiveNav("projects");
    } else if (result.type === "visit") {
      const visitId = result.id.replace("visit-", "");
      const visit = rowsSource.visits.find((item) => item.id === visitId);
      if (visit) openVisitOverlay(visit);
      setActiveNav("schedule");
    } else if (result.type === "file") {
      const fileId = result.id.replace("file-", "");
      const file = rowsSource.files?.find((item) => item.id === fileId);
      if (file) {
        const kind = file.file_kind ?? file.fileKind;
        if (kind === "pdf" || kind === "excel" || kind === "xlsx") downloadAttachment(file);
        else openAttachment(file);
      }
    } else if (result.type === "person") {
      const person = rowsSource.people.find((item) => item.id === result.id.replace("person-", ""));
      if (person) {
        setSelectedPersonId(person.id);
        showDetailOverlay("person");
      }
      setActiveNav("people");
    } else if (result.type === "equipment") {
      setActiveNav("equipment");
    }
  }

  function toggleVisitArray(key, value) {
    setVisitForm((current) => {
      const next = new Set(current[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [key]: [...next] };
    });
  }

  function updateVisitStartDate(value) {
    setVisitForm((current) => {
      const nextDuration = Math.max(1, parseWorkDayCount(current.duration_days));
      const nextDates = editingVisitId ? [value] : collectVisitDates(value, nextDuration);
      return {
        ...current,
        visit_date: value,
        work_scopes: normalizeWorkScopes(current.work_scopes, nextDates.length, current.work_scope),
      };
    });
  }

  function updateVisitDuration(value) {
    const rawValue = String(value ?? "").replace(/\D/g, "");
    const durationDays = Math.min(60, parseWorkDayCount(rawValue));
    setVisitForm((current) => {
      const nextDates = collectVisitDates(current.visit_date, Math.max(1, durationDays));
      return {
        ...current,
        duration_days: rawValue,
        work_scopes: normalizeWorkScopes(current.work_scopes, nextDates.length, current.work_scope),
      };
    });
  }

  function updateVisitWorkScope(index, value) {
    setVisitForm((current) => {
      const durationDays = Math.max(1, parseWorkDayCount(current.duration_days));
      const dates = editingVisitId ? [current.visit_date] : collectVisitDates(current.visit_date, durationDays);
      const nextScopes = normalizeWorkScopes(current.work_scopes, dates.length, current.work_scope);
      nextScopes[index] = value;
      return {
        ...current,
        work_scope: index === 0 ? value : current.work_scope,
        work_scopes: nextScopes,
      };
    });
  }

  function renderSearchIcon(result) {
    const fileKind = result.file_kind ?? result.fileKind;
    if (result.type === "file" && fileKind === "pdf") return <FileText className="pdfIcon" size={18} />;
    if (result.type === "file" && (fileKind === "excel" || fileKind === "xlsx")) return <FileSpreadsheet className="excelIcon" size={18} />;
    if (result.type === "project") return <FolderKanban size={18} />;
    if (result.type === "person") return <UsersRound size={18} />;
    if (result.type === "equipment") return <Truck size={18} />;
    return <Calendar size={18} />;
  }

  function renderSearchBadges(result) {
    const fileKind = result.file_kind ?? result.fileKind;
    if (result.type !== "file") return null;

    return (
      <span className="searchDocBadges">
        <span className="searchDocBadge">
          {fileKind === "pdf" ? <FileText size={13} /> : <FileSpreadsheet size={13} />}
          {fileKind === "pdf" ? "PDF" : "Excel"}
        </span>
      </span>
    );
  }

  function renderAuthScreen() {
    if (!isSupabaseConfigured) {
      return <AuthGate notice="Supabase environment variables are missing. Add them before signing in." />;
    }

    if (session && profile && !profile.is_active) {
      return <PendingAccessScreen notice={notice} onSignOut={signOut} profile={profile} />;
    }

    if (!authReady || (session && !profile)) {
      return <AppSkeletonShell notice={notice || "Checking Supabase session and account access..."} />;
    }

    return (
      <AuthGate
        authEmail={authEmail}
        authFirstName={authFirstName}
        authLastName={authLastName}
        authMode={authMode}
        authPassword={authPassword}
        authPhone={authPhone}
        loading={loading}
        notice={notice}
        onAvatarChange={setAuthAvatarFile}
        onEmailChange={setAuthEmail}
        onFirstNameChange={setAuthFirstName}
        onLastNameChange={setAuthLastName}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onPhoneChange={setAuthPhone}
        onSubmit={signIn}
      />
    );
  }

  function renderMainContent() {
    if (activeNav === "projects") {
      return (
        <>
          <SectionToolbar
            label="Projects"
            onAdd={openAddModal}
            actions={
              <button className="outlineButton" type="button" onClick={exportAllProjectsToExcel}>
                <FileSpreadsheet size={17} />
                Export Excel
              </button>
            }
          />
          <ProjectsView canManage={canManage} getProfileName={getProfileName} projects={rowsSource.projects} onDelete={deleteProject} onEdit={editProject} onSelect={selectProject} />
        </>
      );
    }
    if (activeNav === "people") {
      if (!canManage) {
        return <InfoView icon={UsersRound} title="People access locked" text="People records are available only to Owner, Project Manager, and Office Manager roles." />;
      }
      return (
        <>
          <SectionToolbar label="People" onAdd={openAddModal} />
          <PeopleView avatarUrls={avatarUrls} people={peopleRows} onSelect={openPersonOverlay} pendingPeople={rowsSource.pendingPeople ?? []} onApprove={approvePerson} />
        </>
      );
    }
    if (activeNav === "equipment") {
      return (
        <>
          <SectionToolbar label="Equipment" onAdd={openAddModal} />
          <EquipmentView equipment={rowsSource.equipment} onEdit={editEquipment} />
        </>
      );
    }
    if (activeNav === "documents") {
      return <DocumentsView featureFlags={activeFeatureFlags} files={rowsSource.files ?? []} isRefreshing={isRefreshingWorkspace} onOpen={openAttachment} profiles={rowsSource.people} projects={rowsSource.projects} />;
    }
    if (activeNav === "safetyReports") {
      if (!activeFeatureFlags.safetyForm) {
        return <InfoView icon={FileBarChart2} title="Safety Reports hidden" text="Safety Form is disabled in Developer mode. Existing reports are kept in Supabase and will reappear when the feature is enabled." />;
      }
      return <SafetyReportsView files={rowsSource.files ?? []} onOpen={openAttachment} profiles={rowsSource.people} projects={rowsSource.projects} />;
    }
    if (activeNav === "settings") {
      return <SettingsView featureFlags={activeFeatureFlags} isConfigured={isSupabaseConfigured} profile={profile} />;
    }
    if (activeNav === "overview") {
      return <OverviewView data={rowsSource} getProfileName={getProfileName} getVisitFiles={getVisitFiles} onArrive={startArrivalWorkflow} onComplete={startCompletionWorkflow} onOpenVisit={openVisitOverlay} profile={profile} projects={rowsSource.projects} todayVisits={todayVisits} />;
    }
    return (
      <ScheduleView
        assignmentsReady={assignmentsSource.length > 0}
        availableEquipment={availableTodayEquipment}
        availablePeople={availableTodayPeople}
        equipmentRows={equipmentRows}
        peopleRows={peopleRows}
        projectRows={projectRows}
        avatarUrls={avatarUrls}
        canDeleteTickets={canDeleteTickets}
        projects={rowsSource.projects}
        scheduleMode={scheduleMode}
        selectedDate={selectedDate}
        setScheduleMode={setScheduleMode}
        setSelectedDate={setSelectedDate}
        visits={rowsSource.visits ?? []}
        onAdd={openAddModal}
        onAssignEquipment={assignEquipmentToVisit}
        onAssignPerson={assignPersonToVisit}
        onAssignPeopleGroup={assignPeopleGroupToVisit}
        onDropAssignment={moveVisitAssignment}
        onOpenPerson={openPersonOverlay}
        onOpenProject={selectProject}
        onRemoveEquipmentFromVisit={removeEquipmentFromVisit}
        onRemovePersonFromVisit={removePersonFromVisit}
        onRemoveVisit={deleteVisit}
        onSelect={selectAssignment}
      />
    );
  }

  if (!session || !profile?.is_active) {
    return renderAuthScreen();
  }

  return (
    <div className={`dashboardShell${isMobileMenuOpen ? " mobileMenuOpen" : ""}${isRefreshingWorkspace ? " refreshingData" : ""}`}>
      <div className="mobileDrawerBackdrop" onClick={() => setIsMobileMenuOpen(false)} />
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">B</div>
          <div>
            <strong>BuildCore</strong>
            <span>Construction</span>
          </div>
        </div>

        <nav className="sideNav" aria-label="Application navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeNav === item.id ? "sideNavItem active" : "sideNavItem"}
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button className="sideNavItem drawerOnly" type="button" onClick={() => setNotice("No new notifications.")}>
            <Bell size={20} />
            <span>Notifications</span>
          </button>
        </nav>

        <div className="sidebarUserWrap" ref={accountMenuRef}>
          {isAccountMenuOpen && (
            <div className="accountMenu">
              <button type="button" onClick={openMyProfile}>
                <UserRound size={18} />
                <span>My profile</span>
              </button>
              {canUseDeveloperMode && (
                <button type="button" onClick={openDeveloperMode}>
                  <Wrench size={18} />
                  <span>Developer mode</span>
                </button>
              )}
              <button type="button" onClick={signOut}>
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            </div>
          )}
          <button className={isAccountMenuOpen ? "sidebarUser active" : "sidebarUser"} type="button" onClick={() => setIsAccountMenuOpen((value) => !value)}>
            <Avatar profile={profile} url={avatarUrls[profile?.id]} />
            <span>
              <strong>{currentUserName}</strong>
              <small>{profile ? roleLabel(profile.role) : "Project Manager"}</small>
            </span>
            <ChevronUp size={18} />
          </button>
        </div>
      </aside>

      <main className="mainWorkspace">
        {softPulse && <div className="softHapticPulse" aria-hidden="true" />}
        {(loading || notice) && (
          <div className={loading ? "noticeToast isLoading" : "noticeToast"} key={loading ? `loading-${notice}` : notice}>
            {loading && <span />}
            <strong>{loading ? notice || "Saving changes..." : notice}</strong>
          </div>
        )}
        {uploadProgress && (
          <div className="uploadProgressToast">
            <strong>{uploadProgress.label}</strong>
            <span>{uploadProgress.current} of {uploadProgress.total} uploaded</span>
            <i style={{ width: `${Math.round((uploadProgress.current / Math.max(1, uploadProgress.total)) * 100)}%` }} />
          </div>
        )}
        <div className="mobileTopBar">
          <button className="mobileMenuButton" type="button" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu">
            <Menu size={23} />
          </button>
          <button className="mobileSearchButton" type="button" onClick={() => setIsSearchOpen(true)}>
            <Search size={18} />
            <span>Search</span>
          </button>
        </div>
        <header className="workspaceHeader">
          <div>
            <h1>{activeNav === "schedule" ? "Schedule" : navItems.find((item) => item.id === activeNav)?.label}</h1>
          </div>

          <div className="headerActions">
            <button className="searchTrigger" type="button" onClick={() => setIsSearchOpen(true)}>
              <Search size={18} />
              <span>Search</span>
            </button>

            <button className="iconButton soft" type="button" title="Notifications" onClick={() => setNotice("No new notifications.")}>
              <Bell size={20} />
            </button>

            <button className="sessionButton" type="button" onClick={signOut}>
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </header>

        <section className="contentGrid noProjectPanel">
          <section className="scheduleArea">
            {loading && <div className="loadingBar" />}
            {renderMainContent()}
          </section>

          {false && selectedProject && (
          <aside className="projectPanel">
            <button
              className="panelCloseButton"
              type="button"
              title="Close project panel"
              onClick={() => {
                setSelectedProjectId("");
                setSelectedVisitId("");
              }}
            >
              <X size={18} />
            </button>
            <div className="projectImageWrap">
              <img src={getProjectPhoto(selectedProject.name)} alt="" />
              <span className="projectStatusBadge">{normalizeStatus(selectedProject.status)}</span>
              <button className="imageMenu" type="button" title="More" onClick={() => setNotice(selectedProject.address)}>
                <MoreHorizontal size={20} />
              </button>
            </div>

            <div className="projectTitleBlock">
              <span className="jobNumberPill">{selectedProject.job_number || "No job number"}</span>
              <h2>{selectedProject.name}</h2>
              <p>{selectedProject.category ?? "Construction Project"}</p>
            </div>

            <div className="projectMapWeather">
              <div className="addressLine">
                <MapPin size={18} />
                <span>{selectedProject.address || "No address set"}</span>
                <a href={getGoogleMapsUrl(selectedProject.address)} target="_blank" rel="noreferrer">
                  Open Maps
                </a>
              </div>
              <div className={`weatherCard ${projectWeather.status}`}>
                <CloudSun size={22} />
                {projectWeather.status === "ready" ? (
                  <>
                    <strong>{projectWeather.data.temperature}°C</strong>
                    <span>{projectWeather.data.condition}</span>
                    <small>
                      Feels {projectWeather.data.apparent}°C • Wind {projectWeather.data.wind} km/h • {projectWeather.data.locationName}
                    </small>
                  </>
                ) : projectWeather.status === "error" ? (
                  <>
                    <strong>Weather unavailable</strong>
                    <span>{projectWeather.message}</span>
                  </>
                ) : (
                  <>
                    <strong>Loading weather...</strong>
                    <span>Live site conditions</span>
                  </>
                )}
              </div>
            </div>

            <dl className="projectFacts">
              <ProjectFact icon={ClipboardCheck} label="Job Number" value={selectedProject.job_number || "Not set"} />
              <ProjectFact icon={UserRound} label="Client" value={selectedProject.contact_name || "Not set"} />
              <ProjectFact icon={UsersRound} label="PM / Owner" value={getProfileName(selectedProject.manager_id ?? selectedProject.created_by, currentUserName)} />
              <ProjectFact icon={Calendar} label="Start Date" value={selectedProject.start_date ?? selectedDate} />
              <ProjectFact icon={Calendar} label="End Date" value={selectedProject.end_date ?? "Open"} />
              <ProjectFact icon={CircleGauge} label="Status" value={normalizeStatus(selectedProject.status)} badge />
              <div className="projectFact">
                <Settings size={18} />
                <dt>Progress</dt>
                <dd>
                  <strong>{selectedProject.progress ?? 0}%</strong>
                  <span className="progressTrack">
                    <span style={{ width: `${selectedProject.progress ?? 0}%` }} />
                  </span>
                </dd>
              </div>
            </dl>

            <div className="descriptionBlock">
              <h3>Project Description</h3>
              <p>{selectedProject.description || "No description yet."}</p>
            </div>

            <div className="projectVisitsBlock">
              <div className="panelSectionHeader">
                <h3>Visits</h3>
                <button type="button" onClick={() => openVisitModal(selectedProject.id)}>
                  <Plus size={15} />
                  Add
                </button>
              </div>
              {selectedProjectVisits.length === 0 ? (
                <div className="emptyPanelState">No visits scheduled for this project.</div>
              ) : (
                <div className="projectVisitList">
                  {selectedProjectVisits.slice(0, 8).map((visit) => (
                    <div className={currentVisit?.id === visit.id ? "projectVisitItem active" : "projectVisitItem"} key={visit.id}>
                      <button
                        className="projectVisitMain"
                        type="button"
                        onClick={() => {
                          setSelectedVisitId(visit.id);
                          setSelectedDate(visit.visit_date);
                        }}
                      >
                        <span>
                          <strong>{formatDateLabel(visit.visit_date)}</strong>
                          <small>
                            {formatTimeRange(visit.start_time, visit.end_time)} · {normalizeStatus(visit.status)}
                          </small>
                        </span>
                      </button>
                      <div className="visitMiniActions">
                        {canManage && (
                          <button type="button" title="Edit ticket" onClick={() => editVisit(visit)}>
                            <Edit3 size={16} />
                          </button>
                        )}
                        {canDeleteTickets && (
                          <button className="dangerMini" type="button" title="Remove ticket" onClick={() => deleteVisit(visit)}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="visitActions">
              <button type="button" disabled={!currentVisit?.id} onClick={() => updateVisitStatus("on_site")}>
                <ClipboardCheck size={18} />
                Arrived
              </button>
              <button type="button" disabled={!currentVisit?.id} onClick={() => updateVisitStatus("completed")}>
                <CheckCircle2 size={18} />
                Complete
              </button>
              {canDeleteTickets && (
                <button className="dangerAction" type="button" disabled={!currentVisit?.id} onClick={() => deleteVisit(currentVisit)}>
                  <Trash2 size={18} />
                  Remove
                </button>
              )}
            </div>

            <div className="panelActions">
              <DocumentUploaderShell
                attachments={projectAttachments}
                companyId={rowsSource.companyId}
                profileId={profile?.id}
                projectId={selectedProject.id}
                visitId={null}
                onOpen={openAttachment}
                onUploaded={(message) => {
                  setNotice(message);
                  loadFiles();
                }}
              />

              <button className="photoAction" type="button" onClick={() => setShowAnnotator(true)}>
                <ImagePlus size={18} />
                Mark up photo
              </button>
            </div>

            <button className="viewProjectButton" type="button" onClick={() => setActiveNav("projects")}>
              View Project
              <ChevronRight size={20} />
            </button>
          </aside>
          )}
        </section>

        {isSearchOpen && (
          <div className="searchOverlay" ref={globalSearchRef}>
            <div className="searchBackdrop" onClick={() => setIsSearchOpen(false)} />
            <section className="searchPanel" aria-label="Global search">
              <div className="searchPanelInput">
                <Search size={22} />
                <input
                  ref={searchInputRef}
                  placeholder="Search projects, visits, people, equipment, PDF, Excel..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearchQuery("");
                      setSearchResults([]);
                      setIsSearchOpen(false);
                    }
                  }}
                />
                <button type="button" title="Close search" onClick={() => setIsSearchOpen(false)}>
                  <X size={19} />
                </button>
              </div>

              <div className="searchPanelResults">
                {searchQuery.trim().length < 2 ? (
                  <div className="searchEmptyState">Type at least 2 characters to search across projects, visits, PDFs, and Excel files.</div>
                ) : searchResults.filter((result) => activeFeatureFlags.safetyForm || (result.file_type ?? result.fileType) !== "safety_form").length > 0 ? (
                  searchResults.filter((result) => activeFeatureFlags.safetyForm || (result.file_type ?? result.fileType) !== "safety_form").map((result) => (
                    <button className="searchResult" key={result.id} type="button" onClick={() => handleSearchSelect(result)}>
                      <span className="searchIcon">{renderSearchIcon(result)}</span>
                      <span>
                        <strong>{highlightText(result.title, searchQuery)}</strong>
                        <small>{highlightText(result.subtitle, searchQuery)}</small>
                        <em>{highlightText(result.snippet, searchQuery)}</em>
                        {renderSearchBadges(result)}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="searchEmptyState">Nothing found yet.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {detailOverlay === "project" && selectedProject && (
          <ProjectDetailOverlay
            canDeleteTickets={canDeleteTickets}
            canManage={canManage}
            companyId={rowsSource.companyId}
            currentVisit={currentVisit}
            featureFlags={activeFeatureFlags}
            files={projectAttachments}
            getProfileName={getProfileName}
            onAddVisit={() => openVisitModal(selectedProject.id)}
            onClose={closeDetailOverlay}
            onEditProject={() => editProject(selectedProject)}
            onEditVisit={editVisit}
            onExportPdf={() => exportCurrentProjectPdf(selectedProject)}
            onExportTicketsExcel={() => exportProjectTicketsToExcel(selectedProject)}
            onOpenAttachment={openAttachment}
            onOpenVisit={openVisitOverlay}
            onRemoveVisit={deleteVisit}
            onRemoveActivity={deleteActivityItem}
            onUploaded={(message) => {
              setNotice(message);
              loadFiles();
            }}
            people={rowsSource.people}
            profileId={profile?.id}
            project={selectedProject}
            activities={selectedProjectActivities}
            visits={selectedProjectVisits}
          />
        )}

        {detailOverlay === "visit" && selectedProject && currentVisit && (
          <VisitDetailOverlay
            canDeleteTickets={canDeleteTickets}
            companyId={rowsSource.companyId}
            equipment={currentVisitEquipment}
            featureFlags={activeFeatureFlags}
            files={currentVisitFiles}
            getProfileName={getProfileName}
            onArrive={() => startArrivalWorkflow(currentVisit)}
            onClose={closeDetailOverlay}
            onComplete={() => startCompletionWorkflow(currentVisit)}
            onEdit={() => editVisit(currentVisit)}
            onExportPdf={() => exportCurrentVisitPdf(currentVisit)}
            onOpenAttachment={openAttachment}
            onUploaded={(message) => {
              setNotice(message);
              loadFiles();
            }}
            onRemove={deleteVisit}
            people={currentVisitPeople}
            profileId={profile?.id}
            profiles={rowsSource.people}
            project={selectedProject}
            visit={currentVisit}
          />
        )}

        {detailOverlay === "person" && selectedPerson && (
          <PersonDetailOverlay
            avatarUrl={avatarUrls[selectedPerson.id]}
            canEdit={canManage || selectedPerson.id === profile?.id}
            onEdit={() => (selectedPerson.id === profile?.id ? editMyProfile() : editPerson(selectedPerson))}
            onClose={closeDetailOverlay}
            person={selectedPerson}
          />
        )}

        {modalType === "onboarding" && (
          <AppModal title="Create company" onClose={() => setModalType(null)}>
            <form className="stackForm" onSubmit={createCompany}>
              <FormField label="Company name">
                <input required value={companyForm.company_name} onChange={(event) => setCompanyForm({ ...companyForm, company_name: event.target.value })} />
              </FormField>
              <FormField label="Your name">
                <input value={companyForm.full_name} onChange={(event) => setCompanyForm({ ...companyForm, full_name: event.target.value })} />
              </FormField>
              <FormField label="Phone">
                <input value={companyForm.phone} onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })} />
              </FormField>
              <div className="formActions">
                <button className="addButton" type="submit" disabled={loading}>
                  <Save size={18} />
                  Save company
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "project" && (
          <AppModal title={editingProjectId ? "Edit project" : "Add project"} onClose={closeEditorModal}>
            <form className="stackForm twoColumns" onSubmit={saveProject}>
              <FormField label="Job number">
                <input required value={projectForm.job_number} onChange={(event) => setProjectForm({ ...projectForm, job_number: event.target.value })} />
              </FormField>
              <FormField label="Project name">
                <input required value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} />
              </FormField>
              <FormField label="Address">
                <input required value={projectForm.address} onChange={(event) => setProjectForm({ ...projectForm, address: event.target.value })} />
              </FormField>
              <FormField label="PM / Owner">
                <input readOnly value={getProfileName(projectForm.manager_id || profile?.id, currentUserName)} />
              </FormField>
              <FormField label="Contact name">
                <input value={projectForm.contact_name} onChange={(event) => setProjectForm({ ...projectForm, contact_name: event.target.value })} />
              </FormField>
              <FormField label="Contact email">
                <input type="email" value={projectForm.contact_email} onChange={(event) => setProjectForm({ ...projectForm, contact_email: event.target.value })} />
              </FormField>
              <FormField label="Contact phone">
                <input value={projectForm.contact_phone} onChange={(event) => setProjectForm({ ...projectForm, contact_phone: event.target.value })} />
              </FormField>
              <FormField label="Status">
                <select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>
                  {Object.entries(projectStatusMap).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Work description">
                <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
              </FormField>
              <div className="formActions wide">
                <button className="addButton" type="submit" disabled={loading}>
                  <Save size={18} />
                  {editingProjectId ? "Save changes" : "Save project"}
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "equipment" && (
          <AppModal
            title={editingEquipmentId ? "Edit equipment" : "Add equipment"}
            onClose={() => {
              setEditingEquipmentId(null);
              setEquipmentForm(emptyEquipmentForm);
              setModalType(null);
            }}
          >
            <form className="stackForm" onSubmit={saveEquipment}>
              <FormField label="Name">
                <input required value={equipmentForm.name} onChange={(event) => setEquipmentForm({ ...equipmentForm, name: event.target.value })} />
              </FormField>
                <FormField label="Type">
                  <input required placeholder="Trailer, Excavator, Pickup..." value={equipmentForm.type} onChange={(event) => setEquipmentForm({ ...equipmentForm, type: event.target.value })} />
                </FormField>
                <FormField label="Avatar">
                  <div className="equipmentAvatarPicker">
                    {equipmentAvatarOptions.map((option) => (
                      <button
                        className={equipmentForm.avatar_key === option.key ? "equipmentAvatarOption active" : "equipmentAvatarOption"}
                        key={option.key}
                        type="button"
                        onClick={() => setEquipmentForm({ ...equipmentForm, avatar_key: option.key })}
                      >
                        <EquipmentAvatar item={{ avatar_key: option.key }} />
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </FormField>
                <FormField label="Unit number">
                  <input value={equipmentForm.unit_number} onChange={(event) => setEquipmentForm({ ...equipmentForm, unit_number: event.target.value })} />
                </FormField>
              <FormField label="Notes">
                <textarea value={equipmentForm.notes} onChange={(event) => setEquipmentForm({ ...equipmentForm, notes: event.target.value })} />
              </FormField>
              <div className="formActions">
                <button className="addButton" type="submit" disabled={loading}>
                  <Save size={18} />
                  Save equipment
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "visit" && (
          <AppModal title={editingVisitId ? "Edit visit" : "Schedule visit"} onClose={closeEditorModal}>
            <form className="stackForm twoColumns" onSubmit={saveVisit}>
              <FormField label="Project">
                <select required value={visitForm.project_id} onChange={(event) => setVisitForm({ ...visitForm, project_id: event.target.value })}>
                  <option value="">Select project</option>
                  {rowsSource.projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <DateField label="Date" value={visitForm.visit_date} onChange={updateVisitStartDate} />
              <FormField label="Work days">
                <input
                  disabled={Boolean(editingVisitId)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="1"
                  type="text"
                  value={visitForm.duration_days}
                  onChange={(event) => updateVisitDuration(event.target.value)}
                />
              </FormField>
              <FormField label="Start time">
                <select required value={visitForm.start_time} onChange={(event) => setVisitForm({ ...visitForm, start_time: event.target.value })}>
                  {timePickerOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="End time">
                <select required value={visitForm.end_time} onChange={(event) => setVisitForm({ ...visitForm, end_time: event.target.value })}>
                  {timePickerOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className="workScopeList">
                {visitFormDates.map((date, index) => (
                  <FormField label={visitFormDates.length > 1 ? `Work Scope Day ${index + 1}` : "Work Scope"} key={`${date}-${index}`}>
                    <span className="scopeDatePill">{formatDateLabel(date)}</span>
                    <textarea required value={visitWorkScopes[index] ?? ""} placeholder={`Describe work for ${formatShortDate(date)}`} onChange={(event) => updateVisitWorkScope(index, event.target.value)} />
                  </FormField>
                ))}
              </div>
              {!editingVisitId && (
                <div className="formHint">
                  {visitFormDates.join(", ")}
                </div>
              )}
              <label className="checkLine switchLine">
                <input type="checkbox" checked={visitForm.is_first_visit} onChange={(event) => setVisitForm({ ...visitForm, is_first_visit: event.target.checked })} />
                <span className="switchTrack" aria-hidden="true">
                  <span />
                </span>
                First site visit
              </label>
              <PickerList title="People" items={visitPickerPeople} selected={visitForm.people_ids} labelKey="full_name" onToggle={(id) => toggleVisitArray("people_ids", id)} />
              <PickerList title="Equipment" items={visitPickerEquipment} selected={visitForm.equipment_ids} labelKey="name" onToggle={(id) => toggleVisitArray("equipment_ids", id)} />
              <div className="formActions wide">
                <button className="addButton" type="submit" disabled={loading || !visitForm.project_id}>
                  <Save size={18} />
                  {editingVisitId ? "Save changes" : "Save visit"}
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "safety" && workflowVisit && workflowProject && (
          <AppModal confirmOnClose={safetyFormHasDraft} title="Digital Safety Form" onClose={() => closeModalWithConfirmation(safetyFormHasDraft)} wide>
            <SafetyFormModal
              form={safetyForm}
              hazards={hazardOptions}
              loading={loading}
              onChange={setSafetyForm}
              onSubmit={saveSafetyForm}
              project={workflowProject}
              team={workflowPeople}
              visit={workflowVisit}
            />
          </AppModal>
        )}

        {modalType === "beforePhotos" && workflowVisit && workflowProject && (
          <AppModal confirmOnClose={beforePhotosHaveDraft} title="Before Work Photos" onClose={() => closeModalWithConfirmation(beforePhotosHaveDraft)}>
            <PhotoStepModal
              captions={photoStep.captions}
              files={photoStep.files}
              label="Upload at least one photo before work starts."
              loading={loading}
              onCaption={(key, value) => setPhotoStep((current) => ({ ...current, captions: { ...current.captions, [key]: value } }))}
              onFiles={(files) => setPhotoStep({ kind: "before", visitId: workflowVisit.id, files, captions: {} })}
              onSubmit={saveBeforePhotos}
            />
          </AppModal>
        )}

        {modalType === "completeVisit" && workflowVisit && workflowProject && (
          <AppModal confirmOnClose={completionHasDraft} title="Complete Work" onClose={() => closeModalWithConfirmation(completionHasDraft)}>
            <CompleteVisitModal form={completionForm} loading={loading} onChange={setCompletionForm} onSubmit={saveCompletion} requirePhotos={activeFeatureFlags.beforeAfterPhotos} />
          </AppModal>
        )}

        {modalType === "people" && (
          <AppModal title="Add employee" onClose={() => setModalType(null)}>
            <div className="inviteBox">
              <UserPlus size={22} />
              <div>
                <strong>Create the employee account in Supabase Auth.</strong>
                <p>After the employee signs up and creates a company profile, Owner or PM can assign their role here in People. The next step will be an admin invite flow through an Edge Function.</p>
              </div>
            </div>
          </AppModal>
        )}

        {modalType === "personEdit" && selectedPerson && (
          <AppModal title="Edit employee" onClose={() => setModalType(null)}>
            <form className="stackForm twoColumns" onSubmit={savePerson}>
              <FormField label="First name">
                <input required value={personForm.first_name} onChange={(event) => setPersonForm({ ...personForm, first_name: event.target.value })} />
              </FormField>
              <FormField label="Last name">
                <input required value={personForm.last_name} onChange={(event) => setPersonForm({ ...personForm, last_name: event.target.value })} />
              </FormField>
              <FormField label="Phone">
                <input required value={personForm.phone} onChange={(event) => setPersonForm({ ...personForm, phone: event.target.value })} />
              </FormField>
              <FormField label="Role">
                <select value={personForm.role} onChange={(event) => setPersonForm({ ...personForm, role: event.target.value })}>
                  {roleOptions.map((option) => (
                    <option value={option} key={option}>
                      {roleLabel(option)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Trade">
                <select value={personForm.trade} onChange={(event) => setPersonForm({ ...personForm, trade: event.target.value })}>
                  <option value="">Select trade group</option>
                  {tradeGroups.map((trade) => (
                    <option key={trade} value={trade}>{trade}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Availability">
                <select value={personForm.availability_status} onChange={(event) => setPersonForm({ ...personForm, availability_status: event.target.value })}>
                  <option value="available">Available</option>
                  <option value="not_available">Not Available</option>
                </select>
              </FormField>
              <div className="formActions wide">
                <button className="addButton" type="submit" disabled={loading}>
                  <Save size={18} />
                  Save employee
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {selectedAttachment && (
          <AppModal
            title={selectedAttachment.file_name || "Attachment"}
            onClose={() => {
              setSelectedAttachment(null);
              setViewerItems([]);
              setIsAnnotatingPhoto(false);
              setPhotoZoom(1);
            }}
            wide
          >
            <div className={isAnnotatingPhoto ? "attachmentViewer annotating" : "attachmentViewer"}>
              {selectedAttachment.file_kind === "photo" || selectedAttachment.mime_type?.startsWith("image/") ? (
                <PhotoViewer
                  attachment={selectedAttachment}
                  canDelete={!selectedAttachment.localPreview && (canManage || selectedAttachment.uploaded_by === profile?.id)}
                  isAnnotating={isAnnotatingPhoto}
                  items={viewerItems}
                  loading={loading}
                  onAnnotate={() => setIsAnnotatingPhoto(true)}
                  onCancelAnnotate={() => setIsAnnotatingPhoto(false)}
                  onDelete={removeSelectedAttachment}
                  onDownload={() => downloadAttachment(selectedAttachment)}
                  onSaveAnnotation={annotateSelectedAttachment}
                  onSelect={setSelectedAttachment}
                  onZoom={setPhotoZoom}
                  profiles={rowsSource.people}
                  zoom={photoZoom}
                />
              ) : selectedAttachment.file_kind === "pdf" || selectedAttachment.mime_type === "application/pdf" ? (
                <DocumentFileViewer attachment={selectedAttachment} canDelete={!selectedAttachment.localPreview && (canManage || selectedAttachment.uploaded_by === profile?.id)} loading={loading} onDelete={removeSelectedAttachment} onDownload={() => downloadAttachment(selectedAttachment)}>
                  <iframe title={selectedAttachment.file_name || "PDF"} src={selectedAttachment.viewUrl} />
                </DocumentFileViewer>
              ) : (
                <DocumentFileViewer attachment={selectedAttachment} canDelete={!selectedAttachment.localPreview && (canManage || selectedAttachment.uploaded_by === profile?.id)} loading={loading} onDelete={removeSelectedAttachment} onDownload={() => downloadAttachment(selectedAttachment)}>
                  <div className="documentOpenCard">
                    <FileSpreadsheet size={38} />
                    <strong>Excel workbook</strong>
                    <a href={selectedAttachment.viewUrl} target="_blank" rel="noreferrer">
                      Open Excel file
                    </a>
                  </div>
                </DocumentFileViewer>
              )}
            </div>
          </AppModal>
        )}

        {modalType === "profileEdit" && (
          <AppModal title="Edit my profile" onClose={() => setModalType(null)}>
            <ProfileEditForm avatarUrl={avatarUrls[profile?.id]} form={profileForm} loading={loading} onChange={setProfileForm} onSubmit={saveProfileSettings} profile={profile} />
          </AppModal>
        )}

        {modalType === "developerMode" && (
          <AppModal title="Developer mode" onClose={() => setModalType(null)}>
            <DeveloperModeForm form={developerForm} loading={loading} onChange={setDeveloperForm} onSubmit={saveDeveloperSettings} />
          </AppModal>
        )}

        {confirmation && <ConfirmationSheet confirmation={confirmation} onResolve={resolveConfirmation} />}
      </main>
    </div>
  );
}

function DocumentUploaderShell(props) {
  return (
    <Suspense fallback={<div className="uploaderLoading">Preparing upload tools...</div>}>
      <DocumentUploader {...props} />
    </Suspense>
  );
}

function ConfirmationSheet({ confirmation, onResolve }) {
  return (
    <div className="confirmOverlay" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div className="confirmBackdrop" onClick={() => onResolve(false)} />
      <section className="confirmSheet">
        <button className="confirmClose" type="button" title="Close" onClick={() => onResolve(false)}>
          <X size={18} />
        </button>
        <div className={confirmation.danger ? "confirmGlyph danger" : "confirmGlyph"}>
          {confirmation.danger ? <Trash2 size={22} /> : <CheckCircle2 size={22} />}
        </div>
        <h2 id="confirm-title">{confirmation.title}</h2>
        {confirmation.message && <p id="confirm-message">{confirmation.message}</p>}
        <div className="confirmActions">
          <button className="outlineButton" type="button" onClick={() => onResolve(false)}>
            {confirmation.cancelLabel || "Cancel"}
          </button>
          <button className={confirmation.danger ? "dangerButton" : "addButton"} type="button" onClick={() => onResolve(true)}>
            {confirmation.confirmLabel || "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}

function DetailOverlayShell({ children, onClose, title }) {
  const backdropPointerDownRef = useRef(false);

  function handleBackdropPointerDown(event) {
    backdropPointerDownRef.current = event.target === event.currentTarget;
  }

  function handleBackdropPointerUp(event) {
    if (backdropPointerDownRef.current && event.target === event.currentTarget) onClose();
    backdropPointerDownRef.current = false;
  }

  return (
    <div className="detailOverlay">
      <div className="searchBackdrop" onPointerDown={handleBackdropPointerDown} onPointerUp={handleBackdropPointerUp} />
      <section className="detailPanel">
        <div className="detailHeader">
          <h2>{title}</h2>
          <button type="button" title="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ProjectDetailOverlay({ activities = [], canDeleteTickets, canManage, companyId, currentVisit, featureFlags = defaultFeatureFlags, files, getProfileName, onAddVisit, onClose, onEditProject, onEditVisit, onExportPdf, onExportTicketsExcel, onOpenAttachment, onOpenVisit, onRemoveActivity, onRemoveVisit, onUploaded, people, profileId, project, visits }) {
  return (
    <DetailOverlayShell title={project.name} onClose={onClose}>
      <div className="detailHero projectDetailHeroTextOnly">
        <div>
          <span className="jobNumberPill">{project.job_number || "No job number"}</span>
          <h3>{project.name}</h3>
          <p>{project.description || "No description yet."}</p>
        </div>
        <div className="detailActionRow projectHeroActions">
          <a className="outlineLink" href={getGoogleMapsUrl(project.address)} target="_blank" rel="noreferrer">
            <MapPin size={17} />
            Open Maps
          </a>
          {canManage && (
            <button className="outlineButton" type="button" onClick={onEditProject}>
              <Edit3 size={17} />
              Edit Project
            </button>
          )}
          <button className="outlineButton" type="button" onClick={onExportPdf}>
            <Download size={17} />
            Export PDF
          </button>
          <button className="outlineButton" type="button" onClick={onExportTicketsExcel}>
            <FileSpreadsheet size={17} />
            Tickets Excel
          </button>
        </div>
      </div>

      <dl className="detailFacts">
        <ProjectFact icon={MapPin} label="Address" value={project.address || "Not set"} />
        <ProjectFact icon={UsersRound} label="PM / Owner" value={getProfileName(project.manager_id ?? project.created_by)} />
        <ProjectFact icon={UserRound} label="Contact" value={project.contact_name || "Not set"} />
        <ProjectFact icon={ClipboardCheck} label="Phone" value={project.contact_phone || "Not set"} />
        <ProjectFact icon={CircleGauge} label="Status" value={normalizeStatus(project.status)} badge />
      </dl>

      <div className="detailSection">
        <div className="panelSectionHeader">
          <h3>Visits</h3>
          <button type="button" onClick={onAddVisit}>
            <Plus size={15} />
            Add
          </button>
        </div>
        {visits.length === 0 ? (
          <div className="emptyPanelState">No visits scheduled for this project.</div>
        ) : (
          <div className="detailVisitGrid">
            {visits.map((visit) => (
              <div className={currentVisit?.id === visit.id ? "detailVisitCard active" : "detailVisitCard"} key={visit.id}>
                <button className="detailVisitMain" type="button" onClick={() => onOpenVisit(visit)}>
                  <span>
                    <strong>{formatDateLabel(visit.visit_date)}</strong>
                    <small>
                      {formatTimeRange(visit.start_time, visit.end_time)}
                    </small>
                  </span>
                  <em>{normalizeVisitStatus(visit.status)}</em>
                </button>
                <div className="visitMiniActions">
                  {canManage && (
                    <button type="button" title="Edit ticket" onClick={() => onEditVisit(visit)}>
                      <Edit3 size={16} />
                    </button>
                  )}
                  {canDeleteTickets && (
                    <button className="dangerMini" type="button" title="Remove ticket" onClick={() => onRemoveVisit(visit)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AttachmentSections
        featureFlags={featureFlags}
        files={files}
        onOpen={onOpenAttachment}
        profiles={people}
        uploader={
          canManage
            ? {
                attachments: files,
                companyId,
                profileId,
                projectId: project.id,
                visitId: null,
                onOpen: onOpenAttachment,
                onUploaded,
              }
            : null
        }
      />

      <ActivityFeed activities={activities} canDeleteItems={canDeleteTickets} getProfileName={getProfileName} onDelete={onRemoveActivity} visits={visits} />
    </DetailOverlayShell>
  );
}

function ActivityFeed({ activities = [], canDeleteItems = false, getProfileName, onDelete, visits = [] }) {
  const visitById = new Map(visits.map((visit) => [visit.id, visit]));
  const iconMap = {
    arrived: CheckCircle2,
    completed: ClipboardCheck,
    safety_form_saved: FileText,
    before_photos_uploaded: Camera,
    after_photos_uploaded: Camera,
    photo_annotated: Edit3,
    file_deleted: Trash2,
  };

  return (
    <section className="activityFeed detailSection">
      <div className="panelSectionHeader">
        <h3>Activity Feed</h3>
        <span>{activities.length}</span>
      </div>
      {activities.length === 0 ? (
        <div className="emptyPanelState">No activity recorded yet.</div>
      ) : (
        <div className="activityList">
          {activities.slice(0, 14).map((item) => {
            const Icon = iconMap[item.activity_type] || Activity;
            const visit = visitById.get(item.visit_id);
            return (
              <article className="activityItem" key={item.id}>
                <span className="activityIcon">
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{item.message}</strong>
                  <small>
                    {getProfileName(item.actor_id, "System")} В· {formatDateTimeLabel(item.created_at)}
                    {visit ? ` В· ${formatDateLabel(visit.visit_date)}` : ""}
                  </small>
                </div>
                {canDeleteItems && (
                  <button className="activityDeleteButton" type="button" title="Delete activity row" onClick={() => onDelete?.(item)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VisitDetailOverlay({ canDeleteTickets, companyId, equipment, featureFlags = defaultFeatureFlags, files, getProfileName, onArrive, onClose, onComplete, onEdit, onExportPdf, onOpenAttachment, onRemove, onUploaded, people, profileId, profiles, project, visit }) {
  return (
    <DetailOverlayShell title={`${project.name} Ticket`} onClose={onClose}>
      <div className="ticketHeaderCard">
        <div>
          <span className={`ticketStatus ${visit.status}`}>{normalizeVisitStatus(visit.status)}</span>
          <h3>{visit.work_scope || "Scheduled work"}</h3>
          <p>{formatDateLabel(visit.visit_date)} · {formatTimeRange(visit.start_time, visit.end_time)}</p>
        </div>
        <div className="detailActionRow">
          <button className="outlineButton" type="button" onClick={onEdit}>
            <Edit3 size={17} />
            Edit
          </button>
          <button className="outlineButton" type="button" onClick={onExportPdf}>
            <Download size={17} />
            Export PDF
          </button>
          {canDeleteTickets && (
            <button className="dangerAction" type="button" onClick={() => onRemove(visit)}>
              <Trash2 size={17} />
              Remove
            </button>
          )}
        </div>
      </div>

      <dl className="detailFacts">
        <ProjectFact icon={Calendar} label="Scheduled" value={formatTimeRange(visit.start_time, visit.end_time)} />
        <ProjectFact icon={CheckCircle2} label="Actual start" value={visit.arrived_at ? formatDateTimeLabel(visit.arrived_at) : "Not started"} />
        <ProjectFact icon={ClipboardCheck} label="Actual finish" value={visit.completed_at ? formatDateTimeLabel(visit.completed_at) : "Not finished"} />
        <ProjectFact icon={MapPin} label="Address" value={project.address || "Not set"} />
        <ProjectFact icon={UserRound} label="Contact" value={`${project.contact_name || "Not set"} ${project.contact_phone || ""}`} />
        <ProjectFact icon={ClipboardCheck} label="Assigned by" value={getProfileName(visit.assigned_by ?? visit.created_by)} />
        <ProjectFact icon={UsersRound} label="Team" value={people.map((person) => person.full_name || person.email).join(", ") || "No team assigned"} />
        <ProjectFact icon={Truck} label="Equipment" value={equipment.map((item) => item.name).join(", ") || "No equipment"} />
      </dl>

      <div className="ticketScopeGrid">
        <section>
          <h3>Project Work Description</h3>
          <p>{project.description || "No project work description yet."}</p>
        </section>
        <section>
          <h3>Today Work Scope</h3>
          <p>{visit.work_scope || "No work scope for this ticket."}</p>
        </section>
      </div>

      {visit.status !== "completed" ? (
        <div className="visitActions wideActions">
          {visit.status === "planned" && (
            <button type="button" onClick={onArrive}>
              <ClipboardCheck size={18} />
              Arrived
            </button>
          )}
          {visit.status === "on_site" && (
            <button type="button" onClick={onComplete}>
              <CheckCircle2 size={18} />
              Complete
            </button>
          )}
        </div>
      ) : (
        <div className="thanksBox">Thank you. This ticket is Done.</div>
      )}

      <AttachmentSections
        featureFlags={featureFlags}
        files={files}
        onOpen={onOpenAttachment}
        profiles={profiles}
        uploader={{
          attachments: files,
          companyId,
          profileId,
          projectId: project.id,
          visitId: visit.id,
          onOpen: onOpenAttachment,
          onUploaded,
        }}
      />

    </DetailOverlayShell>
  );
}

function PersonDetailOverlay({ avatarUrl, canEdit, onClose, onEdit, person }) {
  const fullName = profileDisplayName(person, "Unnamed user");
  const phone = person.phone || "";
  const email = person.email || "";

  return (
    <DetailOverlayShell title={fullName} onClose={onClose}>
      <div className="personHero">
        <Avatar profile={person} url={avatarUrl} />
        <div>
          <span className="jobNumberPill">{roleLabel(person.role)}</span>
          <h3>{fullName}</h3>
          <p>{person.trade || "Team member"}</p>
          {person.peopleStatus && <em className={`resourceStatusChip ${person.peopleStatus.tone}`}>{person.peopleStatus.label}</em>}
        </div>
      </div>

      <dl className="detailFacts">
        <ProjectFact icon={UsersRound} label="Role" value={roleLabel(person.role)} />
        <ProjectFact icon={ClipboardCheck} label="Trade" value={person.trade || "Not set"} />
        <ProjectFact icon={CircleGauge} label="Availability" value={person.peopleStatus?.label || "Available"} badge />
        <ProjectFact icon={Phone} label="Phone" value={phone ? <a className="contactFactLink" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a> : "Not set"} />
        <ProjectFact icon={Mail} label="Email" value={email ? <a className="contactFactLink" href={`mailto:${email}`}>{email}</a> : "Not set"} />
      </dl>

      <div className="detailActionRow contactActions">
        {canEdit && (
          <button className="outlineButton" type="button" onClick={onEdit}>
            <Edit3 size={17} />
            Edit
          </button>
        )}
        <a className={phone ? "outlineLink" : "outlineLink disabled"} href={phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : undefined}>
          <Phone size={17} />
          Call
        </a>
        <a className={email ? "outlineLink" : "outlineLink disabled"} href={email ? `mailto:${email}` : undefined}>
          <Mail size={17} />
          Email
        </a>
      </div>
    </DetailOverlayShell>
  );
}

function isAttachmentPhoto(file) {
  return file?.file_kind === "photo" || file?.mime_type?.startsWith("image/");
}

function attachmentKindLabel(file) {
  if (isAttachmentPhoto(file)) return file.visit_id ? "Ticket photo" : "Project photo";
  if (file?.file_type === "safety_form") return "Safety form";
  if (file?.file_kind === "excel" || file?.file_kind === "xlsx") return "Excel";
  if (file?.file_kind === "pdf" || file?.mime_type === "application/pdf") return "PDF";
  return "File";
}

function FilePreviewThumb({ file, size = "card" }) {
  const [urls, setUrls] = useState({});
  const photo = isAttachmentPhoto(file);
  const kind = attachmentKindLabel(file);

  useEffect(() => {
    let alive = true;

    async function loadUrls() {
      try {
        const nextUrls = await createAttachmentUrls(file);
        if (alive) setUrls(nextUrls);
      } catch {
        if (alive) setUrls({});
      }
    }

    if (photo && file?.storage_path) loadUrls();
    return () => {
      alive = false;
    };
  }, [file, photo]);

  return (
    <span className={`filePreviewThumb ${photo ? "photo" : "document"} ${file?.file_kind ?? "file"} ${size}`}>
      {photo && urls.thumbnailUrl ? (
        <img src={urls.thumbnailUrl} alt="" />
      ) : file?.file_kind === "excel" ? (
        <span className="excelMiniature" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : (
        <span className="pdfMiniature" aria-hidden="true">
          <FileText size={size === "row" ? 18 : 22} />
          <b>{kind}</b>
        </span>
      )}
    </span>
  );
}

function AttachmentPreviewCard({ file, onOpen, profiles = [] }) {
  const uploader = profiles.find((profile) => profile.id === file.uploaded_by);

  return (
    <button className={isAttachmentPhoto(file) ? "attachmentCard photo" : "attachmentCard document"} type="button" onClick={() => onOpen(file)}>
      <FilePreviewThumb file={file} />
      <span className="attachmentMeta">
        <strong title={file.file_name}>{file.file_name}</strong>
        <small>{file.photo_caption ? `${file.photo_caption} · ` : ""}{uploader?.full_name || uploader?.email || "Unknown"} · {formatDateTimeLabel(file.created_at)}</small>
      </span>
    </button>
  );
}

function DocumentListRow({ file, onOpen, profiles = [], project }) {
  const uploader = profiles.find((item) => item.id === file.uploaded_by);

  return (
    <button className="documentRow" type="button" onClick={() => onOpen(file)}>
      <FilePreviewThumb file={file} size="row" />
      <span>
        <strong>{file.file_name}</strong>
        <small>{project?.name || "Project"} / {file.visit_id ? "Ticket file" : "Project file"} / {file.photo_caption ? `${file.photo_caption} / ` : ""}{file.file_type?.replaceAll("_", " ")} / {uploader?.full_name || uploader?.email || "Unknown"} / {formatDateTimeLabel(file.created_at)}</small>
      </span>
    </button>
  );
}

function AttachmentSections({ featureFlags = defaultFeatureFlags, files, onOpen, profiles = [], uploader = null }) {
  const flags = normalizeFeatureFlags(featureFlags);
  const groups = [
    flags.safetyForm ? { id: "safety", label: "Safety Forms", icon: FileText, items: files.filter((file) => file.file_type === "safety_form") } : null,
    { id: "projectPhotos", label: "Project Photos", icon: Camera, items: files.filter((file) => file.file_kind === "photo" && !file.visit_id) },
    flags.beforeAfterPhotos ? { id: "before", label: "Before Photos", icon: Camera, items: files.filter((file) => file.file_type === "before_photo" && file.visit_id) } : null,
    flags.beforeAfterPhotos ? { id: "after", label: "After Photos", icon: Camera, items: files.filter((file) => file.file_type === "completion_photo" && file.visit_id) } : null,
    { id: "pdf", label: "PDFs", icon: FileText, items: files.filter((file) => file.file_kind === "pdf" && file.file_type !== "safety_form") },
    { id: "excel", label: "Excel", icon: FileSpreadsheet, items: files.filter((file) => file.file_kind === "excel") },
  ].filter(Boolean);

  return (
    <div className="attachmentSections">
      {uploader && (
        <section className="attachmentUploadSection">
          <div className="panelSectionHeader">
            <h3>Add files</h3>
          </div>
          <DocumentUploaderShell {...uploader} showPreview={false} />
        </section>
      )}
      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <section className={`attachmentSection ${group.id}`} key={group.id}>
            <h3>
              <Icon size={17} />
              {group.label}
              <span>{group.items.length}</span>
            </h3>
            {group.items.length === 0 ? (
              <div className="emptyPanelState">No files yet</div>
            ) : (
              <div className="attachmentStrip">
                {group.items.map((file) => (
                  <AttachmentPreviewCard file={file} key={file.id} onOpen={onOpen} profiles={profiles} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SafetyFormModal({ form, hazards, loading, onChange, onSubmit, project, team, visit }) {
  const presentIds = form.presentIds?.length ? form.presentIds : team.map((person) => person.id);
  const presentTeam = team.filter((person) => presentIds.includes(person.id));
  const absentTeam = team.filter((person) => !presentIds.includes(person.id));
  const signaturesReady = presentTeam.length > 0 && presentTeam.every((person) => form.signatures[person.id]?.trim());
  const canSubmit = form.hazards.length > 0 && signaturesReady;
  const currentTime = formatTimeLabel(`${new Date().getHours()}:${new Date().getMinutes()}`);

  function toggleHazard(hazard) {
    const set = new Set(form.hazards);
    if (set.has(hazard)) set.delete(hazard);
    else set.add(hazard);
    onChange({ ...form, hazards: [...set] });
  }

  function togglePresent(personId) {
    const set = new Set(presentIds);
    if (set.has(personId)) set.delete(personId);
    else set.add(personId);
    onChange({
      ...form,
      presentIds: [...set],
      signatures: set.has(personId) ? form.signatures : { ...form.signatures, [personId]: "" },
    });
  }

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <div className="safetySummary">
        <strong>{project.name}</strong>
        <span>{project.address}</span>
        <span>{formatDateLabel(visit.visit_date)} · Current time {currentTime}</span>
      </div>

      <fieldset className="pickerList safetySwitchList">
        <legend>Potential hazards</legend>
        {hazards.map((hazard) => (
          <label className="safetySwitch" key={hazard}>
            <input type="checkbox" checked={form.hazards.includes(hazard)} onChange={() => toggleHazard(hazard)} />
            <span className="switchTrack" aria-hidden="true">
              <span />
            </span>
            <strong>{hazard}</strong>
          </label>
        ))}
      </fieldset>

      <fieldset className="pickerList safetySwitchList attendanceList">
        <legend>Who is on site?</legend>
        {team.length === 0 ? (
          <span className="mutedLine">No team members assigned to this ticket.</span>
        ) : (
          team.map((person) => (
            <label className="safetySwitch" key={person.id}>
              <input type="checkbox" checked={presentIds.includes(person.id)} onChange={() => togglePresent(person.id)} />
              <span className="switchTrack" aria-hidden="true">
                <span />
              </span>
              <strong>{person.full_name || person.email || "Team member"}</strong>
            </label>
          ))
        )}
        {absentTeam.length > 0 && <small className="attendanceNote">Absent team members will need their own Safety Form when they arrive.</small>}
      </fieldset>

      <FormField label="Safety notes">
        <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FormField>

      <div className="signatureStack">
        <h3>Team signatures</h3>
        {team.length === 0 ? (
          <div className="emptyPanelState">No team members assigned to this ticket.</div>
        ) : presentTeam.length === 0 ? (
          <div className="emptyPanelState">Select at least one team member who is on site.</div>
        ) : (
          presentTeam.map((person) => (
            <SignaturePad
              key={person.id}
              label={person.full_name || person.email || "Team member"}
              onChange={(dataUrl) =>
                onChange({
                  ...form,
                  signatures: { ...form.signatures, [person.id]: dataUrl },
                })
              }
              value={form.signatures[person.id] || ""}
            />
          ))
        )}
      </div>

      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || !canSubmit}>
          <Save size={18} />
          Save Safety PDF
        </button>
      </div>
    </form>
  );
}

function SignaturePad({ label, onChange, value }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  function getPoint(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(event.pointerId);
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);
    drawingRef.current = true;
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function move(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  }

  function end(event) {
    if (!drawingRef.current) return;
    canvasRef.current?.releasePointerCapture?.(event.pointerId);
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="signaturePad">
      <div className="signaturePadHeader">
        <strong>{label}</strong>
        <button type="button" onClick={clear}>
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width="680"
        height="180"
        aria-label={`${label} digital signature`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {!value && <span>Draw signature here</span>}
    </div>
  );
}

function PhotoStepModal({ captions = {}, files = [], label, loading, onCaption, onFiles, onSubmit }) {
  const selectedFiles = Array.isArray(files) ? files : typeof files?.[Symbol.iterator] === "function" ? [...files] : [];

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <div className="workflowCallout">
        <ImagePlus size={22} />
        <span>{label}</span>
      </div>
      <label className="fileDropControl">
        <Upload size={22} />
        <strong>Select photos</strong>
        <span>{selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected` : "JPG, PNG, or WebP"}</span>
        <input accept="image/jpeg,image/png,image/webp" multiple required type="file" onChange={(event) => onFiles([...event.target.files])} />
      </label>
      <div className="selectedFiles">
        {selectedFiles.map((file) => {
          const key = fileInputKey(file);
          return (
            <label className="selectedFileWithCaption" key={key}>
              <span>{file.name}</span>
              <input placeholder="Photo note..." value={captions[key] || ""} onChange={(event) => onCaption?.(key, event.target.value)} />
            </label>
          );
        })}
      </div>
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || selectedFiles.length === 0}>
          <Upload size={18} />
          Save Photos
        </button>
      </div>
    </form>
  );
}

function CompleteVisitModal({ form, loading, onChange, onSubmit, requirePhotos = true }) {
  const selectedFiles = Array.isArray(form.files) ? form.files : [];

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <FormField label="Completion comments">
        <textarea placeholder="Describe completed work, issues, materials, office notes..." value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FormField>
      {requirePhotos && (
        <>
          <div className="workflowCallout">
            <ImagePlus size={22} />
            <span>Upload at least one after photo before completing the ticket.</span>
          </div>
          <label className="fileDropControl">
            <Upload size={22} />
            <strong>Select after photos</strong>
            <span>{selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected` : "JPG, PNG, or WebP"}</span>
            <input accept="image/jpeg,image/png,image/webp" multiple required type="file" onChange={(event) => onChange({ ...form, files: [...event.target.files] })} />
          </label>
          <div className="selectedFiles">
            {selectedFiles.map((file) => {
              const key = fileInputKey(file);
              return (
                <label className="selectedFileWithCaption" key={key}>
                  <span>{file.name}</span>
                  <input placeholder="Photo note..." value={form.captions?.[key] || ""} onChange={(event) => onChange({ ...form, captions: { ...form.captions, [key]: event.target.value } })} />
                </label>
              );
            })}
          </div>
        </>
      )}
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || (requirePhotos && form.files.length === 0)}>
          <CheckCircle2 size={18} />
          Finish Work
        </button>
      </div>
    </form>
  );
}

function ScheduleView({ assignmentsReady, availableEquipment = [], availablePeople = [], avatarUrls, canDeleteTickets, equipmentRows, peopleRows, projectRows = [], projects = [], scheduleMode, selectedDate, setScheduleMode, setSelectedDate, visits = [], onAdd, onAssignEquipment, onAssignPerson, onAssignPeopleGroup, onDropAssignment, onOpenPerson, onOpenProject, onRemoveEquipmentFromVisit, onRemovePersonFromVisit, onRemoveVisit, onSelect }) {
  const [dragPreview, setDragPreview] = useState(null);
  const [peopleGroupDrag, setPeopleGroupDrag] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(selectedDate);
  const calendarWrapRef = useRef(null);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNow = selectedDate === today && nowHour >= scheduleStartHour && nowHour <= scheduleEndHour;
  const nowRatio = Math.max(0, Math.min(1, (nowHour - scheduleStartHour) / (scheduleEndHour - scheduleStartHour)));
  const nowLabel = formatTimeLabel(`${now.getHours()}:${now.getMinutes()}`);
  const shiftCurrentView = (amount) => {
    if (scheduleMode === "month") setSelectedDate(shiftMonth(selectedDate, amount));
    else setSelectedDate(shiftDate(selectedDate, scheduleMode === "week" ? amount * 7 : amount));
  };
  const openDay = (date) => {
    setSelectedDate(date);
    setScheduleMode("day");
  };
  const jumpToToday = () => openDay(new Date().toISOString().slice(0, 10));
  const toggleCalendar = () => {
    setPickerMonth(selectedDate);
    setIsCalendarOpen((value) => !value);
  };

  useEffect(() => {
    if (!isCalendarOpen) return undefined;
    function handlePointerDown(event) {
      if (calendarWrapRef.current?.contains(event.target)) return;
      setIsCalendarOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isCalendarOpen]);

  return (
    <>
      <div className="modeTabs">
        {["day", "week", "month"].map((mode) => (
          <button className={scheduleMode === mode ? "modeTab active" : "modeTab"} key={mode} type="button" onClick={() => setScheduleMode(mode)}>
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      <div className="calendarToolbar">
        <div className="dateStepper">
          <button type="button" title="Previous" onClick={() => shiftCurrentView(-1)}>
            <ChevronLeft size={19} />
          </button>
          <button type="button" title="Next" onClick={() => shiftCurrentView(1)}>
            <ChevronRight size={19} />
          </button>
        </div>

        <div className="calendarPickerWrap scheduleDatePicker" ref={calendarWrapRef}>
          <button className="dateDisplay" type="button" aria-label="Open schedule calendar" onClick={toggleCalendar}>
            <span>{formatDateLabel(selectedDate)}</span>
          </button>
          {isCalendarOpen && (
            <MiniCalendarPicker
              monthDate={pickerMonth}
              selectedDate={selectedDate}
              today={today}
              onClose={() => setIsCalendarOpen(false)}
              onMonthChange={setPickerMonth}
              onSelect={(date) => {
                openDay(date);
                setIsCalendarOpen(false);
              }}
            />
          )}
        </div>

        <div className="toolbarSpacer" />

        <button className="outlineButton" type="button" onClick={jumpToToday}>
          Today
        </button>
        <button className="addButton" type="button" onClick={onAdd}>
          <Plus size={18} />
          Add
        </button>
      </div>

      {scheduleMode === "day" ? (
        <div className="timelineCard" style={{ "--now-ratio": nowRatio, "--time-count": timeLabels.length, "--time-span": scheduleEndHour - scheduleStartHour }}>
          <div className="timelineHeader">
            <div className="allDay">All Day</div>
            {timeLabels.map((label) => (
              <div className="timeLabel" key={label}>
                {label}
              </div>
            ))}
          </div>

          {showNow && (
            <>
              <div className="nowLine" />
              <div className="nowPill">{nowLabel}</div>
            </>
          )}
          {projectRows.length === 0 && <div className="emptyTimeline">No project visits scheduled for this day.</div>}

          <ResourceGroup avatarUrls={avatarUrls} canDeleteTickets={canDeleteTickets} dragPreview={dragPreview} peopleGroupDrag={peopleGroupDrag} setDragPreview={setDragPreview} title="Projects" count={projectRows.length} icon={FolderKanban} rows={projectRows} selectedDate={selectedDate} visits={visits} onAssignEquipment={onAssignEquipment} onAssignPerson={onAssignPerson} onAssignPeopleGroup={onAssignPeopleGroup} onDropAssignment={onDropAssignment} onOpenPerson={onOpenPerson} onOpenProject={onOpenProject} onRemoveVisit={onRemoveVisit} onSelect={onSelect} />
        </div>
      ) : (
        <CalendarTileGrid equipment={equipmentRows} mode={scheduleMode} people={peopleRows} projects={projects} selectedDate={selectedDate} today={today} visits={visits} onSelectDay={openDay} />
      )}

      {scheduleMode === "day" && (
        <div className="availablePools">
          <AvailablePeoplePool avatarUrls={avatarUrls} people={availablePeople} onGroupDragEnd={() => setPeopleGroupDrag(null)} onGroupDragStart={setPeopleGroupDrag} onOpenPerson={onOpenPerson} onRemovePersonFromVisit={onRemovePersonFromVisit} />
          <AvailableEquipmentPool equipment={availableEquipment} onRemoveEquipmentFromVisit={onRemoveEquipmentFromVisit} />
        </div>
      )}
    </>
  );
}

function MiniCalendarPicker({ monthDate, onClose, onMonthChange, onSelect, selectedDate, today }) {
  const days = getMonthDates(monthDate);
  const firstDay = new Date(`${days[0]}T12:00:00`).getDay();
  const leadingSlots = firstDay === 0 ? 6 : firstDay - 1;

  return (
    <div className="miniCalendarPopover">
      <div className="miniCalendarHeader">
        <button type="button" title="Previous month" onClick={() => onMonthChange(shiftMonth(monthDate, -1))}>
          <ChevronLeft size={17} />
        </button>
        <strong>{formatMonthTitle(monthDate)}</strong>
        <button type="button" title="Next month" onClick={() => onMonthChange(shiftMonth(monthDate, 1))}>
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="miniCalendarWeekdays">
        {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="miniCalendarGrid">
        {Array.from({ length: leadingSlots }).map((_, index) => (
          <span className="miniCalendarBlank" key={`blank-${index}`} />
        ))}
        {days.map((date) => (
          <button className={`${date === selectedDate ? "selected" : ""} ${date === today ? "today" : ""}`} key={date} type="button" onClick={() => onSelect(date)}>
            {new Date(`${date}T12:00:00`).getDate()}
          </button>
        ))}
      </div>
      <div className="miniCalendarFooter">
        <button type="button" onClick={() => onSelect(today)}>Today</button>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function CalendarTileGrid({ equipment = [], mode, people = [], projects = [], selectedDate, today, visits = [], onSelectDay }) {
  const days = mode === "week" ? getWeekDates(selectedDate) : getMonthDates(selectedDate);

  return (
    <section className={`calendarTileGrid ${mode}`}>
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
        <div className="calendarWeekday" key={label}>
          {label}
        </div>
      ))}
      {days.map((date) => {
        const index = days.indexOf(date);
        const column = mode === "month" ? (new Date(`${date}T12:00:00`).getDay() + 6) % 7 : index;
        const dayVisits = visits.filter((visit) => visit.visit_date === date && visit.status !== "cancelled");
        const assignedIds = new Set(dayVisits.flatMap((visit) => visit.people_ids ?? []));
        const assignedEquipmentIds = new Set(dayVisits.flatMap((visit) => visit.equipment_ids ?? []));
        const assignedPeople = people.filter((person) => assignedIds.has(person.id));
        const availablePeople = people.filter((person) => !assignedIds.has(person.id) && person.availability_status !== "not_available");
        const unavailablePeople = people.filter((person) => person.availability_status === "not_available");
        const scheduledPeopleDetails = assignedPeople.map((person) => {
          const visit = dayVisits.find((item) => item.people_ids?.includes(person.id));
          const project = projects.find((item) => item.id === visit?.project_id);
          return `${profileDisplayName(person)} (${project?.name || "Scheduled"})`;
        });
        const assignedEquipment = equipment.filter((item) => assignedEquipmentIds.has(item.id));
        const availableEquipment = equipment.filter((item) => !assignedEquipmentIds.has(item.id));
        const scheduledEquipmentDetails = assignedEquipment.map((item) => {
          const visit = dayVisits.find((visitItem) => visitItem.equipment_ids?.includes(item.id));
          const project = projects.find((projectItem) => projectItem.id === visit?.project_id);
          return `${item.name} (${project?.name || "Scheduled"})`;
        });
        const isWeekend = isWeekendDate(date);
        const edgeClass = column >= 5 ? "edgeRight" : column <= 1 ? "edgeLeft" : "";
        const tileStyle = mode === "month" && index === 0 ? { gridColumnStart: column + 1 } : undefined;

        return (
          <button className={`calendarDayTile ${date === selectedDate ? "selected" : ""} ${date === today ? "today" : ""} ${edgeClass} ${isWeekend ? "weekend" : ""}`} key={date} type="button" style={tileStyle} onClick={() => onSelectDay(date)}>
            <span className="calendarDayTop">
              <strong>{new Date(`${date}T12:00:00`).getDate()}</strong>
              <small>{formatShortDate(date)}</small>
            </span>
            <span className="calendarDayStats">
              <em>{dayVisits.length} ticket{dayVisits.length === 1 ? "" : "s"}</em>
              <em>{availablePeople.length} free</em>
              <em>{availableEquipment.length} eq free</em>
            </span>
            <span className="calendarDayProjects">
              {dayVisits.slice(0, 3).map((visit) => {
                const project = projects.find((item) => item.id === visit.project_id);
                return <i key={visit.id}>{project?.name || "Project"}</i>;
              })}
            </span>
            <span className="dayHoverPanel">
              <strong>{formatDateLabel(date)}</strong>
              <small>Scheduled people</small>
              <span>{scheduledPeopleDetails.join(", ") || "No one scheduled"}</span>
              <small>Available people</small>
              <span>{availablePeople.map((person) => profileDisplayName(person)).join(", ") || "No available people"}</span>
              {unavailablePeople.length > 0 && (
                <>
                  <small>Not Available people</small>
                  <span>{unavailablePeople.map((person) => profileDisplayName(person)).join(", ")}</span>
                </>
              )}
              <small>Scheduled equipment</small>
              <span>{scheduledEquipmentDetails.join(", ") || "No equipment scheduled"}</span>
              <small>Available equipment</small>
              <span>{availableEquipment.map((item) => item.name).join(", ") || "No available equipment"}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

function SectionToolbar({ actions, label, onAdd }) {
  return (
    <div className="sectionToolbar">
      <strong>{label}</strong>
      <div className="toolbarButtonGroup">
        {actions}
        <button className="addButton" type="button" onClick={onAdd}>
          <Plus size={18} />
          Add
        </button>
      </div>
    </div>
  );
}

function ProjectsView({ canManage, getProfileName, projects, onDelete, onEdit, onSelect }) {
  return (
    <div className="listView">
      {projects.length === 0 && <div className="emptyState">No projects yet. Press Add to create the first project.</div>}
      {projects.map((project) => (
        <div className="listRow projectListRow" key={project.id}>
          <button className="rowMainButton" type="button" onClick={() => onSelect(project)}>
            <FolderKanban size={20} />
            <span>
              <strong>{project.name}</strong>
              <small>PM / Owner: {getProfileName(project.manager_id ?? project.created_by)}</small>
              <small>{project.job_number ? `${project.job_number} · ${project.address}` : project.address}</small>
            </span>
            <em>{normalizeStatus(project.status)}</em>
          </button>
          {canManage && (
            <div className="rowActions">
              <button type="button" title="Edit project" onClick={() => onEdit(project)}>
                <Edit3 size={16} />
              </button>
              <button className="dangerIcon" type="button" title="Delete project" onClick={() => onDelete(project)}>
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PeopleView({ avatarUrls = {}, people, onApprove, onSelect, pendingPeople = [] }) {
  return (
    <div className="listView">
      {pendingPeople.length > 0 && (
        <section className="pendingRequests">
          <div className="panelSectionHeader">
            <h3>Pending Requests</h3>
            <span>{pendingPeople.length}</span>
          </div>
          {pendingPeople.map((person) => (
            <PendingPersonRow avatarUrl={avatarUrls[person.id]} key={person.id} onApprove={onApprove} onSelect={onSelect} person={person} />
          ))}
        </section>
      )}
      {people.length === 0 && <div className="emptyState">No active employees yet.</div>}
      {people.map((person) => (
        <div className="listRow peopleListRow" key={person.id}>
          <button className="rowMainButton" type="button" onClick={() => onSelect?.(person)}>
            <Avatar profile={person} url={avatarUrls[person.id]} />
            <span>
              <strong>{profileDisplayName(person, "Unnamed user")}</strong>
              <small className="personMetaLine">
                <span>{roleLabel(person.role)}</span>
                {person.peopleStatus && <em className={`resourceStatusChip ${person.peopleStatus.tone}`}>{person.peopleStatus.label}</em>}
              </small>
              <small>{person.phone || person.email || "No contact info"}</small>
            </span>
          </button>
          <em>{person.trade || roleLabel(person.role)}</em>
        </div>
      ))}
    </div>
  );
}

function EquipmentView({ equipment, onEdit }) {
  return (
    <div className="listView">
      {equipment.length === 0 && <div className="emptyState">No equipment yet. Press Add to create trailers, trucks, excavators, or lifts.</div>}
      {equipment.map((item) => (
        <div className="listRow" key={item.id}>
          <EquipmentAvatar item={item} />
          <span>
            <strong>{item.name}</strong>
            <small>{item.type}</small>
          </span>
          <em>{item.unit_number || item.status || "Available"}</em>
          <button className="iconButton soft" type="button" title="Edit equipment" onClick={() => onEdit?.(item)}>
            <Edit3 size={17} />
          </button>
        </div>
      ))}
    </div>
  );
}

function DocumentsView({ featureFlags = defaultFeatureFlags, files, isRefreshing = false, onOpen, profiles, projects }) {
  const flags = normalizeFeatureFlags(featureFlags);
  const sortedFiles = [...files].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  const photoGroups = [
    { id: "projectPhotos", label: "Project Photos", items: sortedFiles.filter((file) => file.file_kind === "photo" && !file.visit_id) },
    flags.beforeAfterPhotos ? { id: "before", label: "Before Photos", items: sortedFiles.filter((file) => file.file_type === "before_photo" && file.visit_id) } : null,
    flags.beforeAfterPhotos ? { id: "after", label: "After Photos", items: sortedFiles.filter((file) => file.file_type === "completion_photo" && file.visit_id) } : null,
  ].filter(Boolean).filter((group) => group.items.length > 0);
  const fileGroups = [
    { id: "pdf", label: "PDFs", icon: FileText, items: sortedFiles.filter((file) => file.file_kind === "pdf" && file.file_type !== "safety_form") },
    { id: "excel", label: "Excel", icon: FileSpreadsheet, items: sortedFiles.filter((file) => file.file_kind === "excel") },
    { id: "other", label: "Other", icon: FileText, items: sortedFiles.filter((file) => !["safety_form", "before_photo", "completion_photo"].includes(file.file_type) && !["pdf", "excel", "photo"].includes(file.file_kind)) },
  ].filter((group) => group.items.length > 0);

  return (
    <div className={isRefreshing ? "documentsView groupedDocuments documentsRefreshing" : "documentsView groupedDocuments"}>
      {files.length === 0 && <div className="emptyState">No documents or photos saved yet.</div>}
      {photoGroups.length > 0 && (
        <section className="documentGroup photoCoverFlowGroup">
          <div className="documentGroupHeader">
            <Camera size={18} />
            <h3>Photo Cover Flow</h3>
            <span>{photoGroups.reduce((total, group) => total + group.items.length, 0)}</span>
          </div>
          <div className="coverFlowShelf">
            {photoGroups.map((group) => (
              <div className="coverFlowLane" key={group.id}>
                <div className="coverFlowLaneTitle">
                  <strong>{group.label}</strong>
                  <em>{group.items.length}</em>
                </div>
                <div className="coverFlowRail">
                  {group.items.map((file, index) => {
                    const project = projects.find((item) => item.id === file.project_id);
                    return <CoverFlowPhotoCard file={file} index={index} key={file.id} onOpen={onOpen} profiles={profiles} project={project} />;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {fileGroups.map((group) => {
        const Icon = group.icon;
        return (
          <section className={`documentGroup macFileGroup ${group.id}`} key={group.id}>
            <div className="documentGroupHeader">
              <Icon size={18} />
              <h3>{group.label}</h3>
              <span>{group.items.length}</span>
            </div>
            <div className="macFileGrid">
              {group.items.map((file) => {
                const project = projects.find((item) => item.id === file.project_id);
                return <MacFileCard file={file} key={file.id} onOpen={onOpen} profiles={profiles} project={project} />;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CoverFlowPhotoCard({ file, index = 0, onOpen, profiles = [], project }) {
  const uploader = profiles.find((item) => item.id === file.uploaded_by);
  return (
    <button className="coverFlowPhotoCard" style={{ "--cover-index": index }} type="button" onClick={() => onOpen(file)}>
      <FilePreviewThumb file={file} />
      <span>
        <strong title={file.file_name}>{file.photo_caption || file.file_name}</strong>
        <small>{project?.name || "Project"} / {uploader?.full_name || uploader?.email || "Unknown"}</small>
      </span>
    </button>
  );
}

function MacFileCard({ file, onOpen, profiles = [], project }) {
  const uploader = profiles.find((item) => item.id === file.uploaded_by);
  const kind = attachmentKindLabel(file);
  return (
    <button className={`macFileCard ${file.file_kind || "file"}`} type="button" onClick={() => onOpen(file)}>
      <FilePreviewThumb file={file} />
      <span className="macFileMeta">
        <strong title={file.file_name}>{file.file_name}</strong>
        <small>{project?.name || "Project"}</small>
        <em>{kind} / {file.visit_id ? "Ticket file" : "Project file"} / {uploader?.full_name || uploader?.email || "Unknown"}</em>
      </span>
    </button>
  );
}

function SafetyReportsView({ files, onOpen, profiles, projects }) {
  const safetyFiles = files
    .filter((file) => file.file_type === "safety_form")
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

  return (
    <div className="documentsView groupedDocuments safetyReportsView">
      <section className="documentGroup safety">
        <div className="documentGroupHeader">
          <FileBarChart2 size={18} />
          <h3>Safety Reports</h3>
          <span>{safetyFiles.length}</span>
        </div>
        {safetyFiles.length === 0 ? (
          <div className="emptyState">No safety reports saved yet.</div>
        ) : (
          safetyFiles.map((file) => {
            const project = projects.find((item) => item.id === file.project_id);
            return <DocumentListRow file={file} key={file.id} onOpen={onOpen} profiles={profiles} project={project} />;
          })
        )}
      </section>
    </div>
  );
}

function DocumentsViewLegacy({ files, onOpen, profiles, projects }) {
  return (
    <div className="documentsView">
      {files.length === 0 && <div className="emptyState">No documents or photos saved yet.</div>}
      {files.map((file) => {
        const project = projects.find((item) => item.id === file.project_id);
        const uploader = profiles.find((item) => item.id === file.uploaded_by);
        return (
          <button className="documentRow" key={file.id} type="button" onClick={() => onOpen(file)}>
            <span className="searchIcon">{file.file_kind === "photo" ? <ImagePlus size={18} /> : file.file_kind === "excel" ? <FileSpreadsheet size={18} /> : <FileText size={18} />}</span>
            <span>
              <strong>{file.file_name}</strong>
              <small>{project?.name || "Project"} · {file.file_type?.replaceAll("_", " ")} · {uploader?.full_name || uploader?.email || "Unknown"} · {formatDateTimeLabel(file.created_at)}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PendingPersonRow({ avatarUrl, onApprove, onSelect, person }) {
  const [role, setRole] = useState("builder");

  return (
    <div className="listRow peopleListRow pendingRow">
      <button className="rowMainButton" type="button" onClick={() => onSelect?.(person)}>
        <Avatar profile={person} url={avatarUrl} />
        <span>
          <strong>{profileDisplayName(person, "Unnamed user")}</strong>
          <small>{person.email || "No email saved"}</small>
          <small>{person.phone || "No phone saved"}</small>
        </span>
      </button>
      <select value={role} onChange={(event) => setRole(event.target.value)}>
        {roleOptions.map((option) => (
          <option value={option} key={option}>
            {roleLabel(option)}
          </option>
        ))}
      </select>
      <button className="addButton compactButton" type="button" onClick={() => onApprove?.(person, role)}>
        <CheckCircle2 size={16} />
        Approve
      </button>
    </div>
  );
}

function OverviewView({ data, getProfileName, getVisitFiles, onArrive, onComplete, onOpenVisit, projects, todayVisits }) {
  const [weather, setWeather] = useState({ status: "idle", data: null });
  const firstVisit = todayVisits[0];
  const firstProject = firstVisit ? projects.find((project) => project.id === firstVisit.project_id) : null;

  useEffect(() => {
    let alive = true;
    if (!firstProject?.address) {
      setWeather({ status: "idle", data: null });
      return undefined;
    }

    setWeather({ status: "loading", data: null });
    getWeatherForAddress(firstProject.address)
      .then((data) => {
        if (alive) setWeather({ status: "ready", data });
      })
      .catch((error) => {
        if (alive) setWeather({ status: "error", message: error.message, data: null });
      });

    return () => {
      alive = false;
    };
  }, [firstProject?.address]);

  return (
    <div className="todayTickets">
      {todayVisits.length === 0 && <div className="emptyState">No visits assigned to you today.</div>}
      {todayVisits.map((visit) => {
        const project = projects.find((item) => item.id === visit.project_id);
        const files = getVisitFiles(visit);
        const hasSafety = files.some((file) => file.file_type === "safety_form");
        const hasBefore = files.some((file) => file.file_type === "before_photo");
        const hasAfter = files.some((file) => file.file_type === "completion_photo");
        const sitePhone = project?.contact_phone || "";
        const callablePhone = sitePhone.replace(/[^\d+]/g, "");
        const assignedPeople = (data.people ?? []).filter((person) => visit.people_ids?.includes(person.id));
        const assignedEquipment = (data.equipment ?? []).filter((item) => visit.equipment_ids?.includes(item.id));

        return (
          <section className="todayTicket" key={visit.id}>
            <div className="ticketTopLine">
              <span className={`ticketStatus ${visit.status}`}>{normalizeVisitStatus(visit.status)}</span>
              <button className="outlineButton" type="button" onClick={() => onOpenVisit(visit)}>
                View Ticket
              </button>
            </div>
            <h2>{project?.name || "Project visit"}</h2>
            <div className="overviewScopeGrid">
              <section>
                <span>Project work description</span>
                <p>{project?.description || "No project description saved yet."}</p>
              </section>
              <section>
                <span>Today's work scope</span>
                <p>{visit.work_scope || "Today's scheduled work"}</p>
              </section>
            </div>

            <dl className="detailFacts compact">
              <ProjectFact icon={Calendar} label="Ticket Date" value={formatDateLabel(visit.visit_date)} />
              <ProjectFact
                icon={MapPin}
                label="Address"
                value={
                  project?.address ? (
                    <span className="factInlineActions">
                      <span>{project.address}</span>
                      <a href={getGoogleMapsUrl(project.address)} target="_blank" rel="noreferrer">
                        <MapPin size={14} />
                        Maps
                      </a>
                    </span>
                  ) : (
                    "Not set"
                  )
                }
              />
              <ProjectFact icon={CloudSun} label="Weather" value={weather.status === "ready" ? `${weather.data.temperature}°C, ${weather.data.condition}` : weather.status === "loading" ? "Loading..." : "Not available"} />
              <ProjectFact
                icon={UserRound}
                label="Site Contact"
                value={
                  <span className="factInlineActions">
                    <span>{project?.contact_name || "Not set"}</span>
                    {sitePhone && (
                      <a href={`tel:${callablePhone}`}>
                        <Phone size={14} />
                        {sitePhone}
                      </a>
                    )}
                  </span>
                }
              />
              <ProjectFact icon={ClipboardCheck} label="Assigned by" value={getProfileName(visit.assigned_by ?? visit.created_by)} />
              <ProjectFact icon={ClipboardCheck} label="Checklist" value={`Safety ${hasSafety ? "done" : "needed"} · Before ${hasBefore ? "done" : "needed"} · After ${hasAfter ? "done" : "needed"}`} />
            </dl>

            <div className="overviewAssignmentGrid">
              <section>
                <h3>Assigned people</h3>
                {assignedPeople.length ? (
                  <div className="overviewChipList">
                    {assignedPeople.map((person) => (
                      <span key={person.id}>{profileDisplayName(person)}</span>
                    ))}
                  </div>
                ) : (
                  <p>No people assigned.</p>
                )}
              </section>
              <section>
                <h3>Equipment</h3>
                {assignedEquipment.length ? (
                  <div className="overviewChipList">
                    {assignedEquipment.map((item) => (
                      <span key={item.id}>{item.name}</span>
                    ))}
                  </div>
                ) : (
                  <p>No equipment assigned.</p>
                )}
              </section>
            </div>

            {visit.status === "planned" && (
              <div className="visitActions wideActions">
                <button type="button" onClick={() => onArrive(visit)}>
                  <ClipboardCheck size={18} />
                  Arrived
                </button>
              </div>
            )}
            {visit.status === "on_site" && (
              <div className="visitActions wideActions">
                <button type="button" onClick={() => onComplete(visit)}>
                  <CheckCircle2 size={18} />
                  Complete Work
                </button>
              </div>
            )}
            {visit.status === "completed" && <div className="thanksBox">Thank you. Work is Done.</div>}
          </section>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="metricCard">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function InfoView({ icon: Icon, title, text }) {
  return (
    <div className="infoView">
      <Icon size={28} />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function SettingsView({ featureFlags = defaultFeatureFlags, isConfigured, profile }) {
  const flags = normalizeFeatureFlags(featureFlags);
  return (
    <div className="listView">
      <div className="listRow">
        <Settings size={20} />
        <span>
          <strong>Supabase</strong>
          <small>{isConfigured ? "Connected with environment variables" : "Not configured"}</small>
        </span>
      </div>
      <div className="settingsSummaryPanel">
        <div>
          <strong>Workspace</strong>
          <small>{profile?.company_id ? "Company data sync is active" : "No company connected"}</small>
        </div>
        <div className="settingsFeatureGrid">
          <span className={flags.safetyForm ? "featurePill on" : "featurePill off"}>Safety Form {flags.safetyForm ? "On" : "Off"}</span>
          <span className={flags.beforeAfterPhotos ? "featurePill on" : "featurePill off"}>Before / After Photos {flags.beforeAfterPhotos ? "On" : "Off"}</span>
          <span className={flags.testBots ? "featurePill on" : "featurePill off"}>Test Bots {flags.testBots ? "On" : "Off"}</span>
        </div>
      </div>
    </div>
  );
}

function ProfileEditForm({ avatarUrl, form, loading, onChange, onSubmit, profile }) {
  return (
    <form className="settingsProfileForm" onSubmit={onSubmit}>
      <div className="settingsAvatarBlock">
        <Avatar profile={profile} url={avatarUrl} />
        <span>
          <strong>{profileDisplayName(profile, "Not signed in")}</strong>
          <small>{profile ? roleLabel(profile.role) : "No profile yet"}</small>
        </span>
      </div>
      <div className="twoColumns">
        <FormField label="First name">
          <input required value={form.first_name} onChange={(event) => onChange({ ...form, first_name: event.target.value })} />
        </FormField>
        <FormField label="Last name">
          <input required value={form.last_name} onChange={(event) => onChange({ ...form, last_name: event.target.value })} />
        </FormField>
      </div>
      <FormField label="Phone">
        <input autoComplete="tel" required type="tel" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} />
      </FormField>
      <label className="fileDropControl settingsAvatarUpload">
        <Upload size={22} />
        <strong>Choose avatar photo</strong>
        <span>{form.avatarFile?.name || "JPG, PNG, or WebP"}</span>
        <input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => onChange({ ...form, avatarFile: event.target.files?.[0] ?? null, removeAvatar: false })} />
      </label>
      <label className="checkLine switchLine">
        <input type="checkbox" checked={form.removeAvatar} onChange={(event) => onChange({ ...form, removeAvatar: event.target.checked, avatarFile: null })} />
        <span className="switchTrack" aria-hidden="true">
          <span />
        </span>
        Remove avatar and use no-name icon
      </label>
      <div className="formActions">
        <button className="addButton" type="submit" disabled={loading}>
          <Save size={18} />
          Save profile
        </button>
      </div>
    </form>
  );
}

function DeveloperModeForm({ form, loading, onChange, onSubmit }) {
  return (
    <form className="developerModeForm" onSubmit={onSubmit}>
      <DeveloperSwitch
        checked={form.safetyForm}
        description="When off, Arrived skips the digital safety form and Safety Reports are hidden without deleting saved reports."
        label="Safety Form"
        onChange={(checked) => onChange({ ...form, safetyForm: checked })}
      />
      <DeveloperSwitch
        checked={form.beforeAfterPhotos}
        description="When off, Arrived and Complete no longer require before or after photos. Existing photos stay saved."
        label="Before / After Photos"
        onChange={(checked) => onChange({ ...form, beforeAfterPhotos: checked })}
      />
      <DeveloperSwitch
        checked={form.testBots}
        description="Create temporary builder profiles for People and Schedule testing. Turning this off removes only test bots."
        label="Test Bots"
        onChange={(checked) => onChange({ ...form, testBots: checked })}
      />
      {form.testBots && (
        <FormField label="How many test bots?">
          <input inputMode="numeric" min="1" max="100" value={form.botCount} onChange={(event) => onChange({ ...form, botCount: event.target.value.replace(/\D/g, "") })} />
        </FormField>
      )}
      <div className="formActions">
        <button className="addButton" type="submit" disabled={loading}>
          <Save size={18} />
          Save developer mode
        </button>
      </div>
    </form>
  );
}

function DeveloperSwitch({ checked, description, label, onChange }) {
  return (
    <label className="developerSwitch">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="switchLine">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switchTrack" aria-hidden="true">
          <span />
        </span>
      </span>
    </label>
  );
}

function PickerList({ title, items, selected, labelKey, onToggle }) {
  return (
    <fieldset className="pickerList">
      <legend>{title}</legend>
      {items.length === 0 && <span className="mutedLine">No records yet</span>}
      {items.map((item) => {
        const status = item.pickerStatus;
        return (
          <label className="pickerOption" key={item.id}>
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            <span className="switchTrack pickerSwitch" aria-hidden="true">
              <span />
            </span>
            <span className="pickerOptionText">
              <strong>{item[labelKey]}</strong>
              {status?.detail && <small>{status.detail}</small>}
            </span>
            {status && <em className={`resourceStatusChip ${status.tone}`}>{status.label}</em>}
          </label>
        );
      })}
    </fieldset>
  );
}

function AppModal({ children, onClose, title, wide = false }) {
  const backdropPointerDownRef = useRef(false);

  function handleBackdropPointerDown(event) {
    backdropPointerDownRef.current = event.target === event.currentTarget;
  }

  function handleBackdropPointerUp(event) {
    if (backdropPointerDownRef.current && event.target === event.currentTarget) onClose();
    backdropPointerDownRef.current = false;
  }

  return (
    <div className="modalBackdrop" onPointerDown={handleBackdropPointerDown} onPointerUp={handleBackdropPointerUp}>
      <div className={wide ? "modal wideModal" : "modal"}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton soft" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}

function AppSkeletonShell({ notice }) {
  return (
    <main className="appSkeletonShell" aria-label="Loading workspace">
      <aside>
        <div className="skeletonBrand" />
        {Array.from({ length: 7 }).map((_, index) => (
          <span className="skeletonLine" key={index} />
        ))}
      </aside>
      <section>
        <div className="skeletonHeader">
          <span />
          <i />
        </div>
        <div className="skeletonTimeline">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="skeletonRow" key={index}>
              <span />
              <i />
              <i />
            </div>
          ))}
        </div>
        <strong>{notice || "Loading BuildCore..."}</strong>
      </section>
    </main>
  );
}

function PendingAccessScreen({ notice, onSignOut, profile }) {
  return (
    <main className="authGate">
      <section className="authVisual" aria-hidden="true">
        <div className="authBrandCard">
          <div className="brandMark">B</div>
          <span>BuildCore Construction</span>
        </div>
        <div className="authPreview pendingPreview">
          <div className="authPreviewHeader">
            <span />
            <span />
            <span />
          </div>
          <strong>Pending Request</strong>
          <p>Owner, Project Manager, or Office Manager must approve this account and assign a role.</p>
        </div>
      </section>

      <section className="authPanel" aria-label="Pending access">
        <div className="authCard">
          <div className="authLogo">
            <div className="brandMark">B</div>
            <div>
              <strong>BuildCore</strong>
              <span>Access request</span>
            </div>
          </div>
          <div className="authCopy">
            <h1>Waiting for approval</h1>
            <p>{profileDisplayName(profile, "Your account")} is saved as a pending employee request. The workspace will open after approval.</p>
          </div>
          {notice && <div className="authNotice">{notice}</div>}
          <div className="pendingProfileCard">
            <strong>{profileDisplayName(profile, "Unnamed user")}</strong>
            <span>{profile.email || "Email saved in Supabase Auth"}</span>
            <span>{profile.phone || "Phone pending"}</span>
          </div>
          <button className="outlineButton fullWidth" type="button" onClick={onSignOut}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}

function AuthGate({
  authEmail = "",
  authFirstName = "",
  authLastName = "",
  authMode = "signin",
  authPassword = "",
  authPhone = "",
  loading = false,
  notice = "",
  onAvatarChange,
  onEmailChange,
  onFirstNameChange,
  onLastNameChange,
  onModeChange,
  onPasswordChange,
  onPhoneChange,
  onSubmit,
}) {
  const canSubmit = typeof onSubmit === "function";
  const isChecking = loading && !canSubmit;

  return (
    <main className="authGate">
      <section className="authVisual" aria-hidden="true">
        <div className="authBrandCard">
          <div className="brandMark">B</div>
          <span>BuildCore Construction</span>
        </div>
        <div className="authPreview">
          <div className="authPreviewHeader">
            <span />
            <span />
            <span />
          </div>
          <div className="authPreviewGrid">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </section>

      <section className="authPanel" aria-label="Account access">
        <div className="authCard">
          <div className="authLogo">
            <div className="brandMark">B</div>
            <div>
              <strong>BuildCore</strong>
              <span>Construction PM</span>
            </div>
          </div>

          <div className="authCopy">
            <h1>{isChecking ? "Checking access" : !canSubmit ? "Supabase required" : authMode === "signup" ? "Create Owner Account" : "Sign in"}</h1>
            <p>
              {isChecking
                ? "Supabase is confirming your session before opening the workspace."
                : !canSubmit
                  ? "Connect Supabase before opening the workspace."
                  : "Only verified Supabase accounts with company access can open the workspace."}
            </p>
          </div>

          {notice && <div className="authNotice">{notice}</div>}

          {isChecking || !canSubmit ? (
            <div className="authLoader">
              {isChecking && <span />}
              <strong>{isChecking ? "Verifying account..." : "Access locked"}</strong>
            </div>
          ) : (
            <form className="authForm" onSubmit={onSubmit}>
              {authMode === "signup" && (
                <div className="authNameGrid">
                  <FormField label="First name">
                    <input autoComplete="given-name" required value={authFirstName} onChange={(event) => onFirstNameChange?.(event.target.value)} />
                  </FormField>
                  <FormField label="Last name">
                    <input autoComplete="family-name" required value={authLastName} onChange={(event) => onLastNameChange?.(event.target.value)} />
                  </FormField>
                  <FormField label="Phone">
                    <input autoComplete="tel" required type="tel" value={authPhone} onChange={(event) => onPhoneChange?.(event.target.value)} />
                  </FormField>
                  <FormField label="Avatar photo (optional)">
                    <input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => onAvatarChange?.(event.target.files?.[0] ?? null)} />
                  </FormField>
                </div>
              )}
              <FormField label="Email">
                <input autoComplete="email" required type="email" value={authEmail} onChange={(event) => onEmailChange?.(event.target.value)} />
              </FormField>
              <FormField label="Password">
                <input
                  autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  type="password"
                  value={authPassword}
                  onChange={(event) => onPasswordChange?.(event.target.value)}
                />
              </FormField>
              <div className="authActions">
                <button className="outlineButton" type="button" onClick={() => onModeChange?.(authMode === "signup" ? "signin" : "signup")}>
                  {authMode === "signup" ? "I have account" : "Create account"}
                </button>
                <button className="addButton" type="submit" disabled={loading}>
                  <LogIn size={18} />
                  {authMode === "signup" ? "Create" : "Sign in"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function ResourceGroup({ avatarUrls = {}, canDeleteTickets, dragPreview, peopleGroupDrag, setDragPreview, title, count, icon: Icon, rows, selectedDate, visits = [], onAssignEquipment, onAssignPerson, onAssignPeopleGroup, onDropAssignment, onOpenPerson, onOpenProject, onRemoveVisit, onSelect }) {
  return (
    <div className="resourceGroup">
      <div className="groupLabel">
        <Icon size={18} />
        <span>
          {title} ({count})
        </span>
        <ChevronDown size={15} />
      </div>

      {rows.map((row) => (
        <div className="resourceRow" key={row.id} style={{ "--lane-count": Math.max(1, row.laneCount ?? row.assignments.length) }}>
          <button
            className="resourceIdentity"
            type="button"
            onClick={() => {
              if (row.kind === "project") onOpenProject?.(row);
            }}
            onPointerUp={(event) => {
              if (event.pointerType !== "touch" || row.kind !== "project") return;
              event.preventDefault();
              onOpenProject?.(row);
            }}
            aria-disabled={row.kind !== "project"}
            title={row.kind === "project" ? "Open project" : undefined}
          >
            {row.kind === "person" ? (
              <Avatar profile={row} url={avatarUrls[row.id]} />
            ) : row.kind === "project" ? (
              <div className={`equipmentAvatar projectAvatar ${row.color ?? "blue"}`}>{makeInitials(row.name, "PR")}</div>
            ) : (
              <EquipmentAvatar item={row} />
            )}
            <div>
              <div className="resourceTitleLine">
                <strong>{row.full_name}</strong>
                {row.resourceStatus && <em className={`resourceStatusChip ${row.resourceStatus.tone}`}>{row.resourceStatus.label}</em>}
              </div>
              <span>{row.subtitle ?? roleLabel(row.role)}</span>
              {row.resourceStatus?.detail && <small>{row.resourceStatus.detail}</small>}
            </div>
          </button>

          <div
            className="rowTrack"
            onDragLeave={() => setDragPreview?.(null)}
            onDragOver={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData("application/json");
              if (!raw) return;
              const assignment = JSON.parse(raw);
              const rect = event.currentTarget.getBoundingClientRect();
              const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              const duration = Math.max(0.25, assignment.end - assignment.start);
              const rawStart = scheduleStartHour + percent * (scheduleEndHour - scheduleStartHour);
              const start = Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, Math.round(rawStart * 4) / 4));
              const end = start + duration;
              setDragPreview?.({
                rowId: row.id,
                left: ((start - scheduleStartHour) / (scheduleEndHour - scheduleStartHour)) * 100,
                width: ((end - start) / (scheduleEndHour - scheduleStartHour)) * 100,
                label: formatTimeRange(toTimeValue(start), toTimeValue(end)),
              });
            }}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData("application/json");
              if (!raw) return;
              setDragPreview?.(null);
              onDropAssignment?.({ assignment: JSON.parse(raw), row, clientX: event.clientX, trackElement: event.currentTarget });
            }}
          >
            {dragPreview?.rowId === row.id && <div className="dragPreview" style={{ left: `${dragPreview.left}%`, width: `${dragPreview.width}%` }}>{dragPreview.label}</div>}
            {row.assignments.map((assignment) => {
              const visit = visits.find((item) => item.id === assignment.visitId) ?? {
                id: assignment.visitId,
                project_id: assignment.projectId,
                visit_date: selectedDate,
              };
              return <ScheduleBlock assignment={assignment} avatarUrls={avatarUrls} canDeleteTickets={canDeleteTickets} key={assignment.id || assignment.visitId} peopleGroupDrag={peopleGroupDrag} visits={visits} onAssignEquipment={onAssignEquipment} onAssignPerson={onAssignPerson} onAssignPeopleGroup={onAssignPeopleGroup} onOpenPerson={onOpenPerson} onRemove={() => onRemoveVisit?.(visit)} onSelect={onSelect} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AvailablePeoplePool({ avatarUrls = {}, people = [], onGroupDragEnd, onGroupDragStart, onOpenPerson, onRemovePersonFromVisit }) {
  const [isDropActive, setIsDropActive] = useState(false);
  const acceptsAssignedPerson = (event) => event.dataTransfer.types.includes("application/x-buildcore-assigned-person");
  const sortedPeople = [...people].sort((a, b) => profileDisplayName(a).localeCompare(profileDisplayName(b)));
  const groupedPeople = tradeGroups
    .map((trade) => ({ trade, people: sortedPeople.filter((person) => person.trade === trade) }))
    .concat([{ trade: unassignedTradeLabel, people: sortedPeople.filter((person) => !tradeGroups.includes(person.trade)) }])
    .filter((group) => group.people.length > 0);

  return (
    <section
      className={isDropActive ? "availablePeoplePool dropActive" : "availablePeoplePool"}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsDropActive(false);
      }}
      onDragOver={(event) => {
        if (!acceptsAssignedPerson(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsDropActive(true);
      }}
      onDrop={(event) => {
        const raw = event.dataTransfer.getData("application/x-buildcore-assigned-person");
        if (!raw) return;
        event.preventDefault();
        setIsDropActive(false);
        onRemovePersonFromVisit?.(JSON.parse(raw));
      }}
    >
      <div>
        <strong>Available today</strong>
        <span>{people.length ? "Drag a group or one person into a ticket" : "Drop assigned people here to remove them from a ticket"}</span>
      </div>
      <div className="availableTradeScroller">
        {groupedPeople.map((group) => (
          <div
            className="availableTradeGroup"
            draggable={group.people.length > 0}
            key={group.trade}
            onDragEnd={() => onGroupDragEnd?.()}
            onDragStart={(event) => {
              const payload = { count: group.people.length, trade: group.trade, personIds: group.people.map((person) => person.id) };
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData("application/x-buildcore-person-group", JSON.stringify(payload));
              onGroupDragStart?.(payload);
              setCompactDragImage(event, { count: group.people.length, label: group.trade, tone: "crew" });
            }}
          >
            <div className="availableTradeHeader">
              <strong>{group.trade}</strong>
              <em>{group.people.length}</em>
            </div>
            <div className="availableAvatarStrip">
              {group.people.map((person) => (
                <button
                  className="availableAvatarCard"
                  draggable
                  key={person.id}
                  type="button"
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("application/x-buildcore-person", person.id);
                  }}
                  onClick={() => onOpenPerson?.(person)}
                >
                  <Avatar profile={person} url={avatarUrls[person.id]} />
                  <span>{profileDisplayName(person)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AvailableEquipmentPool({ equipment = [], onRemoveEquipmentFromVisit }) {
  const [isDropActive, setIsDropActive] = useState(false);
  const acceptsAssignedEquipment = (event) => event.dataTransfer.types.includes("application/x-buildcore-assigned-equipment");
  const sortedEquipment = [...equipment].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));

  return (
    <section
      className={isDropActive ? "availablePeoplePool availableEquipmentPool dropActive" : "availablePeoplePool availableEquipmentPool"}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsDropActive(false);
      }}
      onDragOver={(event) => {
        if (!acceptsAssignedEquipment(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsDropActive(true);
      }}
      onDrop={(event) => {
        const raw = event.dataTransfer.getData("application/x-buildcore-assigned-equipment");
        if (!raw) return;
        event.preventDefault();
        setIsDropActive(false);
        onRemoveEquipmentFromVisit?.(JSON.parse(raw));
      }}
    >
      <div>
        <strong>Available equipment</strong>
        <span>{equipment.length ? "Drag equipment into a ticket" : "Drop assigned equipment here to remove it"}</span>
      </div>
      <div className="availableAvatarStrip">
        {sortedEquipment.map((item) => (
          <button
            className="availableAvatarCard equipmentCard"
            draggable
            key={item.id}
            type="button"
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData("application/x-buildcore-equipment", item.id);
            }}
          >
            <EquipmentAvatar item={item} />
            <span>{item.name}</span>
            <small>{item.unit_number || item.type}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function ScheduleBlock({ assignment, avatarUrls = {}, canDeleteTickets, peopleGroupDrag, visits = [], onAssignEquipment, onAssignPerson, onAssignPeopleGroup, onOpenPerson, onRemove, onSelect }) {
  const [dropHint, setDropHint] = useState(null);
  const span = scheduleEndHour - scheduleStartHour;
  const left = Math.max(0, ((assignment.start - scheduleStartHour) / span) * 100);
  const width = Math.min(100 - left, ((assignment.end - assignment.start) / span) * 100);
  const isShortBlock = width < 16;
  const isTightBlock = width < 24;
  const laneCount = Math.max(1, assignment.laneCount ?? 1);
  const laneIndex = Math.min(laneCount - 1, Math.max(0, assignment.laneIndex ?? 0));
  const verticalStyle =
    laneCount > 1
      ? {
          top: `calc(10px + (${laneIndex} * ((100% - 20px) / ${laneCount})))`,
          bottom: "auto",
          height: `calc((100% - 20px) / ${laneCount} - 8px)`,
        }
      : {};
  const openAssignment = () => onSelect(assignment);

  return (
    <div
      className={`scheduleBlock ${assignment.color} ${assignment.status ?? ""} ${dropHint ? "showDropHint" : ""} ${isShortBlock ? "shortBlock" : ""} ${isTightBlock ? "tightBlock" : ""}`}
      draggable={Boolean(assignment.visitId)}
      role="button"
      style={{ left: `${left}%`, width: `${width}%`, ...verticalStyle }}
      tabIndex={0}
      onClick={openAssignment}
      onPointerUp={(event) => {
        if (event.pointerType !== "touch") return;
        event.preventDefault();
        openAssignment();
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/json", JSON.stringify(assignment));
      }}
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes("application/x-buildcore-person") ||
          event.dataTransfer.types.includes("application/x-buildcore-person-group") ||
          event.dataTransfer.types.includes("application/x-buildcore-assigned-person") ||
          event.dataTransfer.types.includes("application/x-buildcore-equipment") ||
          event.dataTransfer.types.includes("application/x-buildcore-assigned-equipment")
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          const isGroupDrag = event.dataTransfer.types.includes("application/x-buildcore-person-group");
          const groupRaw = event.dataTransfer.getData("application/x-buildcore-person-group");
          if (isGroupDrag) {
            let group = peopleGroupDrag;
            try {
              if (groupRaw) group = JSON.parse(groupRaw);
            } catch {
              group = peopleGroupDrag;
            }
            const summary = getCrewGroupDropSummary({ assignment, group, visits });
            const totalCount = summary.totalCount || group?.personIds?.length || 0;
            const visibleCount = summary.availableCount || (summary.conflictCount ? 0 : totalCount);
            setDropHint({
              label: `+${visibleCount} crew`,
              detail: summary.conflictCount > 0 ? `${summary.conflictCount} conflict${summary.conflictCount === 1 ? "" : "s"} skipped` : `${group?.trade || "Crew group"} ready`,
              tone: summary.conflictCount > 0 ? "warning" : "ready",
            });
          } else if (event.dataTransfer.types.includes("application/x-buildcore-equipment") || event.dataTransfer.types.includes("application/x-buildcore-assigned-equipment")) {
            event.dataTransfer.dropEffect = "copy";
            setDropHint({ label: "+ equipment", detail: "Assign to ticket", tone: "ready" });
          } else {
            setDropHint({ label: "+ person", detail: "Assign to ticket", tone: "ready" });
          }
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropHint(null);
      }}
      onDrop={(event) => {
        const personId = event.dataTransfer.getData("application/x-buildcore-person");
        const personGroupRaw = event.dataTransfer.getData("application/x-buildcore-person-group");
        const assignedPersonRaw = event.dataTransfer.getData("application/x-buildcore-assigned-person");
        const equipmentId = event.dataTransfer.getData("application/x-buildcore-equipment");
        const assignedEquipmentRaw = event.dataTransfer.getData("application/x-buildcore-assigned-equipment");
        const hasPeopleGroupDrag = Boolean(peopleGroupDrag && event.dataTransfer.types.includes("application/x-buildcore-person-group"));
        if (!personId && !personGroupRaw && !hasPeopleGroupDrag && !assignedPersonRaw && !equipmentId && !assignedEquipmentRaw) return;
        event.preventDefault();
        event.stopPropagation();
        setDropHint(null);
        if (personId) {
          onAssignPerson?.({ personId, visitId: assignment.visitId });
          return;
        }
        if (personGroupRaw) {
          const group = JSON.parse(personGroupRaw);
          onAssignPeopleGroup?.({ personIds: group.personIds ?? [], visitId: assignment.visitId });
          return;
        }
        if (peopleGroupDrag && event.dataTransfer.types.includes("application/x-buildcore-person-group")) {
          onAssignPeopleGroup?.({ personIds: peopleGroupDrag.personIds ?? [], visitId: assignment.visitId });
          return;
        }
        if (equipmentId) {
          onAssignEquipment?.({ equipmentId, visitId: assignment.visitId });
          return;
        }
        if (assignedPersonRaw) {
          const assignedPerson = JSON.parse(assignedPersonRaw);
          if (assignedPerson?.personId) {
            onAssignPerson?.({ personId: assignedPerson.personId, sourceVisitId: assignedPerson.visitId, visitId: assignment.visitId });
            return;
          }
        }
        if (assignedEquipmentRaw) {
          const assignedEquipment = JSON.parse(assignedEquipmentRaw);
          if (assignedEquipment?.equipmentId) {
            onAssignEquipment?.({ equipmentId: assignedEquipment.equipmentId, sourceVisitId: assignedEquipment.visitId, visitId: assignment.visitId });
          }
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openAssignment();
      }}
    >
      {dropHint && (
        <span className={`scheduleDropHint ${dropHint.tone ?? ""}`}>
          <strong>{dropHint.label}</strong>
          <small>{dropHint.detail}</small>
        </span>
      )}
      <span className="scheduleBlockTop">
        <strong>{assignment.title}</strong>
        {assignment.status && <em className="scheduleBlockStatus">{normalizeVisitStatus(assignment.status)}</em>}
      </span>
      {assignment.timeText && <small className="scheduleBlockTime">{assignment.timeText}</small>}
      {assignment.people?.length > 0 && (
        <div className="assignmentCrew">
          <div className="assignmentAvatarStack">
            {assignment.people.slice(0, 5).map((person) => (
              <button
                className="crewAvatarButton"
                draggable
                key={person.id}
                type="button"
                title={`Open ${profileDisplayName(person)}. Drag to Available to remove from ticket.`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenPerson?.(person);
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-buildcore-assigned-person", JSON.stringify({ personId: person.id, visitId: assignment.visitId }));
                }}
              >
                <Avatar profile={person} url={avatarUrls[person.id]} />
              </button>
            ))}
          </div>
          <i>{assignment.people.map((person) => profileDisplayName(person)).join(", ")}</i>
        </div>
      )}
      {assignment.equipment?.length > 0 && (
        <div className="assignmentCrew assignmentEquipment">
          <div className="assignmentAvatarStack">
            {assignment.equipment.slice(0, 4).map((item) => (
              <button
                className="crewAvatarButton equipmentCrewButton"
                draggable
                key={item.id}
                type="button"
                title={`Drag ${item.name} to Available equipment to remove from ticket.`}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("application/x-buildcore-assigned-equipment", JSON.stringify({ equipmentId: item.id, visitId: assignment.visitId }));
                }}
              >
                <EquipmentAvatar item={item} small />
              </button>
            ))}
          </div>
          <i>{assignment.equipment.map((item) => item.name).join(", ")}</i>
        </div>
      )}
      {canDeleteTickets && assignment.visitId && (
        <button
          className="scheduleDeleteButton"
          type="button"
          title="Remove ticket"
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
            onRemove?.();
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function PhotoViewer({ attachment, canDelete, isAnnotating, items = [], loading, onAnnotate, onCancelAnnotate, onDelete, onDownload, onSaveAnnotation, onSelect, onZoom, profiles = [], zoom }) {
  const uploader = profiles.find((person) => person.id === attachment.uploaded_by);
  const history = Array.isArray(attachment.annotation_history) ? attachment.annotation_history : [];
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === attachment.id));
  const hasMultiplePhotos = items.length > 1;
  const previousPhoto = hasMultiplePhotos ? items[(currentIndex - 1 + items.length) % items.length] : null;
  const nextPhoto = hasMultiplePhotos ? items[(currentIndex + 1) % items.length] : null;

  if (isAnnotating) {
    return (
      <div className="photoAnnotatorPanel">
        <div className="viewerTopBar">
          <div>
            <strong>Annotate photo</strong>
            <small>Draw, add shapes or text, then save to replace the original.</small>
          </div>
          <button className="outlineButton" type="button" onClick={onCancelAnnotate}>
            <X size={17} />
            Cancel
          </button>
        </div>
        <Suspense fallback={<div className="annotatorLoading">Preparing annotation tools...</div>}>
          <PhotoAnnotator imageUrl={attachment.viewUrl} onSave={onSaveAnnotation} />
        </Suspense>
      </div>
    );
  }

  return (
    <section className="photoViewer">
      <div className="viewerTopBar">
        <div>
          <strong>{uploader ? `Uploaded by ${uploader.full_name || uploader.email}` : "Photo details"}</strong>
          <small>{formatDateTimeLabel(attachment.created_at)}</small>
          {attachment.photo_caption && <p className="photoCaption">{attachment.photo_caption}</p>}
        </div>
        <div className="viewerControls">
          <button type="button" title="Previous photo" disabled={!previousPhoto} onClick={() => previousPhoto && onSelect(previousPhoto)}>
            <ChevronLeft size={17} />
          </button>
          <button type="button" title="Next photo" disabled={!nextPhoto} onClick={() => nextPhoto && onSelect(nextPhoto)}>
            <ChevronRight size={17} />
          </button>
          <button type="button" title="Zoom out" onClick={() => onZoom(Math.max(0.65, zoom - 0.15))}>
            <ZoomOut size={17} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" title="Zoom in" onClick={() => onZoom(Math.min(2.4, zoom + 0.15))}>
            <ZoomIn size={17} />
          </button>
          <button type="button" title="Download" onClick={onDownload}>
            <Download size={17} />
          </button>
          <button type="button" title="Annotate" onClick={onAnnotate}>
            <Edit3 size={17} />
          </button>
          {canDelete && (
            <button className="dangerIcon" type="button" title="Delete photo" disabled={loading} onClick={onDelete}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>

      <div className="photoStage">
        {previousPhoto && (
          <button className="photoStageNav previous" type="button" title="Previous photo" onClick={() => onSelect(previousPhoto)}>
            <ChevronLeft size={28} />
          </button>
        )}
        <img src={attachment.viewUrl} alt={attachment.file_name || "Visit photo"} style={{ transform: `scale(${zoom})` }} />
        {nextPhoto && (
          <button className="photoStageNav next" type="button" title="Next photo" onClick={() => onSelect(nextPhoto)}>
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      <div className="filmstrip">
        {items.map((item) => (
          <button className={item.id === attachment.id ? "active" : ""} key={item.id} type="button" onClick={() => onSelect(item)}>
            <img src={item.thumbnailUrl || item.viewUrl} alt="" />
          </button>
        ))}
      </div>

      <div className="annotationHistory">
        <h3>Annotation History</h3>
        {history.length === 0 ? (
          <div className="emptyPanelState">No annotations saved yet.</div>
        ) : (
          history.map((entry, index) => (
            <div className="historyRow" key={`${entry.at}-${index}`}>
              <Edit3 size={15} />
              <span>
                <strong>{entry.action?.replaceAll("_", " ") || "Annotation saved"}</strong>
                <small>{formatDateTimeLabel(entry.at)} / {entry.objectCount ?? 0} object(s)</small>
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DocumentFileViewer({ attachment, canDelete, children, loading, onDelete, onDownload }) {
  return (
    <section className="documentFileViewer">
      <div className="viewerTopBar">
        <div>
          <strong>{attachment.visit_id ? "Ticket file" : "Project file"}</strong>
          <small>{formatDateTimeLabel(attachment.created_at)}</small>
        </div>
        <div className="viewerControls">
          <button type="button" title="Download" onClick={onDownload}>
            <Download size={17} />
          </button>
          {canDelete && (
            <button className="dangerIcon" type="button" title="Delete file" disabled={loading} onClick={onDelete}>
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function ProjectFact({ icon: Icon, label, value, badge }) {
  return (
    <div className="projectFact">
      <Icon size={18} />
      <dt>{label}</dt>
      <dd>{badge ? <span className="factBadge">{value}</span> : value}</dd>
    </div>
  );
}
