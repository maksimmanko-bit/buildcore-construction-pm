import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { jsPDF } from "jspdf";
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
  CircleHelp,
  Home,
  ImagePlus,
  KeyRound,
  Mail,
  MapPin,
  LogIn,
  LogOut,
  Menu,
  MessageSquarePlus,
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
import { createAttachmentUrls, createProfileAvatarUrl, deleteVisitFile, replaceVisitPhotoWithAnnotation, uploadProfileAvatar, uploadVisitAttachment, uploadVisitGeneratedFile, uploadVisitPhoto } from "./lib/storage.js";
import { localGlobalSearch } from "./lib/search.js";
import { getGoogleMapsUrl, getWeatherForAddress } from "./lib/weather.js";
import { readCachedWorkspace, scheduleWorkspaceCacheWrite } from "./lib/localCache.js";
import { loadPdfDocumentFromUrl } from "./lib/fileText.js";
import { recordClientError } from "./lib/errorLog.js";
import { countOfflineOperations, deleteOfflineOperation, enqueueOfflineOperation, isProbablyOfflineError, readOfflineOperations } from "./lib/offlineQueue.js";
import DocumentUploader from "./components/DocumentUploader.jsx";
import { VoiceTextArea, VoiceTextInput } from "./components/VoiceDictation.jsx";

const PhotoAnnotator = lazy(() => import("./components/PhotoAnnotator.jsx"));

const WINNIPEG_TIME_ZONE = "America/Winnipeg";
const PRODUCTION_SITE_URL = "https://maksimmanko-bit.github.io/buildcore-construction-pm/";
const AUTH_REDIRECT_URL = ensureTrailingSlash(import.meta.env.VITE_AUTH_REDIRECT_URL || PRODUCTION_SITE_URL);
const PASSWORD_RECOVERY_REDIRECT_URL = import.meta.env.VITE_PASSWORD_RECOVERY_REDIRECT_URL || `${PRODUCTION_SITE_URL}?mode=recovery`;

function getWinnipegParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WINNIPEG_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function getWinnipegDateValue(date = new Date()) {
  const parts = getWinnipegParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getWinnipegTimeValue(date = new Date()) {
  const parts = getWinnipegParts(date);
  return `${parts.hour}:${parts.minute}`;
}

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
const profileEmojiOptions = [
  "👷",
  "🧑‍💼",
  "👩‍💼",
  "👨‍🔧",
  "🧑‍🔧",
  "🧑‍🏭",
  "🧑‍💻",
  "🧑‍🎨",
  "🧑‍🚒",
  "🧑‍✈️",
  "🧑‍🍳",
  "🧑‍⚕️",
  "😊",
  "😎",
  "🤝",
  "👍",
  "💪",
  "⭐",
  "✨",
  "🔥",
  "💡",
  "🎯",
  "📌",
  "📋",
  "📎",
  "📐",
  "📏",
  "🧰",
  "🛠️",
  "⚙️",
  "🔧",
  "🔨",
  "🪛",
  "🔩",
  "🦺",
  "🚧",
  "🏗️",
  "🏠",
  "🏢",
  "🏘️",
  "🚚",
  "🚜",
  "🛻",
  "⚡",
  "☀️",
  "🌤️",
  "❄️",
  "💧",
  "🌲",
  "🍁",
  "🏔️",
  "🌊",
  "☕",
  "🍕",
  "🍔",
  "🍟",
  "🍩",
  "🍪",
  "🍎",
  "🥑",
  "🎧",
  "🎸",
  "🥁",
  "🎮",
  "⚽",
  "🏒",
  "🏀",
  "🏈",
  "🎾",
  "🏆",
  "🚀",
  "✈️",
  "🚗",
  "🧭",
  "🗺️",
  "🔑",
  "💼",
  "📱",
  "💻",
  "⌚",
  "📷",
  "🎥",
  "🔍",
  "📦",
  "🧾",
  "💬",
  "✅",
  "🟦",
  "🟩",
  "🟥",
  "🟨",
  "🟧",
  "🟪",
];
const defaultProfileAvatarOptions = ["👷", "🧑‍💼", "🧑‍🔧", "🧑‍🏭", "🧑‍💻", "🧑‍🎨", "💪", "⭐", "💡", "🎯", "🧰", "⚙️", "🏗️", "🏠", "🚚", "⚡", "☀️", "🍁", "🎧", "🏆", "🚀", "📷", "✅", "🔑"];

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
  visitNotes: [],
  siteVisits: [],
  changeOrders: [],
  notifications: [],
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
  { id: "siteVisits", label: "Site Inspection", icon: ClipboardCheck },
  { id: "changeOrders", label: "Change Order", icon: FileBarChart2 },
  { id: "people", label: "People", icon: UsersRound },
  { id: "equipment", label: "Equipment", icon: Truck },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "safetyReports", label: "Safety Reports", icon: FileBarChart2 },
];
const settingsNavIds = ["people", "equipment", "documents", "safetyReports"];

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
function normalizeChangeOrderStatus(status) {
  return status === "approved" || status === "completed" ? "approved" : "requested";
}

function changeOrderStatusLabel(status) {
  return normalizeChangeOrderStatus(status) === "approved" ? "Approved" : "Requested";
}

const safetyTemplateObjectTypes = [
  { id: "text", label: "Text" },
  { id: "checkboxes", label: "Checkbox block" },
  { id: "textarea", label: "Text field" },
  { id: "select", label: "Choice field" },
];
const safetyCheckboxLimit = 12;
const defaultSafetyTemplate = {
  version: 1,
  objects: [
    {
      id: "psi-checklist",
      type: "checkboxes",
      title: "Potential hazards",
      required: true,
      items: [
        { id: "working-at-heights", label: "Working at heights", details: false },
        { id: "excavation-trench", label: "Excavation / trench", details: false },
        { id: "electrical-hazard", label: "Electrical hazard", details: false },
        { id: "heavy-equipment", label: "Heavy equipment", details: false },
        { id: "traffic-public-access", label: "Traffic / public access", details: false },
        { id: "weather-exposure", label: "Weather exposure", details: false },
        { id: "dust-silica", label: "Dust / silica", details: false },
        { id: "manual-lifting", label: "Manual lifting", details: false },
      ],
    },
    {
      id: "safety_notes",
      type: "textarea",
      title: "Safety notes",
      required: false,
      placeholder: "Add jobsite notes, controls, or office attention items...",
    },
  ],
};
const timeLabels = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM"];
const colors = ["blue", "green", "yellow", "purple", "orange"];
const scheduleStartHour = 7;
const scheduleEndHour = 22;
const defaultFeatureFlags = {
  safetyForm: true,
  beforeAfterPhotos: true,
  siteInspections: true,
  changeOrders: true,
  testBots: false,
  safetyTemplate: defaultSafetyTemplate,
};

function normalizeFeatureFlags(flags) {
  const next = { ...defaultFeatureFlags, ...(flags && typeof flags === "object" ? flags : {}) };
  next.safetyTemplate = normalizeSafetyTemplate(next.safetyTemplate);
  return next;
}

function makeStableId(value = "item") {
  const base = String(value || "item")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return `${base || "item"}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSafetyTemplate(template) {
  const source = template && typeof template === "object" ? template : defaultSafetyTemplate;
  const objects = Array.isArray(source.objects) && source.objects.length ? source.objects : defaultSafetyTemplate.objects;
  return {
    version: 1,
    objects: objects
      .map((object, objectIndex) => {
        const type = safetyTemplateObjectTypes.some((item) => item.id === object?.type) ? object.type : "text";
        const title = String(object?.title || (type === "text" ? "Information" : `Safety item ${objectIndex + 1}`)).trim();
        const base = {
          id: object?.id || makeStableId(`${type}-${objectIndex + 1}`),
          type,
          title,
          required: Boolean(object?.required),
        };
        if (type === "checkboxes") {
          const items = Array.isArray(object.items) ? object.items : [];
          return {
            ...base,
            items: items.slice(0, safetyCheckboxLimit).map((item, itemIndex) => ({
              id: item?.id || makeStableId(`${title}-${itemIndex + 1}`),
              label: String(item?.label || `Checkbox ${itemIndex + 1}`).trim(),
              details: Boolean(item?.details),
            })),
          };
        }
        if (type === "textarea") {
          return { ...base, placeholder: String(object?.placeholder || "Type notes here...") };
        }
        if (type === "select") {
          const options = Array.isArray(object.options) ? object.options : [];
          return {
            ...base,
            options: options.map((option) => String(option || "").trim()).filter(Boolean).slice(0, 12),
          };
        }
        return { ...base, body: String(object?.body || "Safety information text.").trim() };
      })
      .filter((object) => object.type !== "checkboxes" || object.items.length > 0)
      .filter((object) => object.type !== "select" || object.options.length > 0)
      .slice(0, 24),
  };
}

function emptySafetyResponses(template = defaultSafetyTemplate) {
  return Object.fromEntries(
    normalizeSafetyTemplate(template).objects.map((object) => [
      object.id,
      object.type === "checkboxes" ? { checked: [], details: {} } : object.type === "textarea" ? "" : object.type === "select" ? "" : true,
    ]),
  );
}

function safetyResponseText(object, value) {
  if (object.type === "text") return object.body || "";
  if (object.type === "textarea") return String(value || "").trim();
  if (object.type === "select") return String(value || "").trim();
  if (object.type === "checkboxes") {
    const checked = new Set(value?.checked ?? []);
    return object.items
      .filter((item) => checked.has(item.id))
      .map((item) => `${item.label}${value?.details?.[item.id] ? `: ${value.details[item.id]}` : ""}`)
      .join(", ");
  }
  return "";
}

function safetyTemplateHasRequiredResponses(template, responses = {}) {
  return normalizeSafetyTemplate(template).objects.every((object) => {
    if (!object.required || object.type === "text") return true;
    const value = responses[object.id];
    if (object.type === "checkboxes") return (value?.checked ?? []).length > 0;
    return Boolean(String(value || "").trim());
  });
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
  addresses: [{ id: "primary", label: "Main address", address: "" }],
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
  address: "",
  visit_date: getWinnipegDateValue(),
  duration_days: "1",
  start_time: "07:00",
  end_time: "17:00",
  work_scope: "",
  work_scopes: [""],
  is_first_visit: false,
  people_ids: [],
  equipment_ids: [],
};
const emptyPhotoFolder = { id: "folder-1", name: "", description: "", files: [], captions: {} };
const emptySiteVisitForm = {
  project_id: "",
  visit_date: getWinnipegDateValue(),
  start_time: "07:00",
  end_time: "17:00",
  status: "planned",
  description: "",
  files: [],
  captions: {},
  folders: [],
};

const fieldReportLabels = {
  siteVisit: { singular: "Site Inspection", plural: "Site Inspections", photos: "Site Inspection Photos" },
  changeOrder: { singular: "Change Order", plural: "Change Orders", photos: "Change Order Photos" },
};

function getFieldReportLabel(kind, plural = false) {
  const entry = fieldReportLabels[kind] ?? fieldReportLabels.changeOrder;
  return plural ? entry.plural : entry.singular;
}

function makeProjectAddress(index = 1, address = "", label = "") {
  return {
    id: `address-${Date.now()}-${index}`,
    label: label || (index === 1 ? "Main address" : `Address ${index}`),
    address,
  };
}

function normalizeProjectAddresses(projectOrForm = {}) {
  const source = projectOrForm && typeof projectOrForm === "object" ? projectOrForm : {};
  const rawAddresses = Array.isArray(source.addresses) ? source.addresses : [];
  const normalized = rawAddresses
    .map((item, index) => {
      if (typeof item === "string") return makeProjectAddress(index + 1, item, index === 0 ? "Main address" : `Address ${index + 1}`);
      return { id: item?.id || `address-${index + 1}`, label: item?.label || (index === 0 ? "Main address" : `Address ${index + 1}`), address: item?.address ?? "" };
    })
    .filter((item) => item.address.trim());
  const primary = String(source.address ?? "").trim();
  if (primary && !normalized.some((item) => item.address.trim() === primary)) {
    normalized.unshift({ id: "primary", label: "Main address", address: primary });
  }
  return normalized.length ? normalized : [{ id: "primary", label: "Main address", address: primary }];
}

function primaryProjectAddress(projectOrForm = {}) {
  return normalizeProjectAddresses(projectOrForm)[0]?.address ?? "";
}

function getProjectAddressOptions(projectOrForm = {}) {
  const seen = new Set();
  return normalizeProjectAddresses(projectOrForm).filter((item) => {
    const key = item.address.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getVisitAddress(visit, project) {
  return visit?.address || primaryProjectAddress(project);
}

function filterResultsByFeatures(results = [], flags = defaultFeatureFlags) {
  const normalized = normalizeFeatureFlags(flags);
  return results.filter((result) => {
    if (result.type === "siteVisit") return normalized.siteInspections;
    if (result.type === "changeOrder") return normalized.changeOrders;
    return true;
  });
}

function nextChangeOrderNumber(project, changeOrders = []) {
  const jobNumber = String(project?.job_number || "NO-JOB").trim() || "NO-JOB";
  const prefix = `CO-${jobNumber}-`;
  const maxExisting = changeOrders
    .filter((item) => item.project_id === project?.id)
    .map((item) => Number.parseInt(String(item.order_number || "").replace(prefix, ""), 10))
    .filter(Number.isFinite)
    .reduce((max, value) => Math.max(max, value), 0);
  return `${prefix}${maxExisting + 1}`;
}

function normalizeJobNumber(value = "") {
  return String(value ?? "").trim().toLowerCase();
}

function projectJobNumberExists(projects = [], jobNumber = "", ignoreProjectId = "") {
  const normalized = normalizeJobNumber(jobNumber);
  if (!normalized) return false;
  return projects.some((project) => project.id !== ignoreProjectId && normalizeJobNumber(project.job_number) === normalized);
}

function nextSequentialJobNumber(projects = []) {
  const used = new Set(projects.map((project) => String(project.job_number || "").trim()).filter(Boolean));
  let max = 0;
  projects.forEach((project) => {
    const value = String(project.job_number || "").trim();
    if (/^\d{6}$/.test(value)) max = Math.max(max, Number.parseInt(value, 10));
  });
  let next = max + 1;
  while (used.has(String(next).padStart(6, "0"))) next += 1;
  return String(next).padStart(6, "0");
}
const emptyChangeOrderForm = {
  project_id: "",
  order_date: getWinnipegDateValue(),
  order_time: getWinnipegTimeValue(),
  status: "requested",
  description: "",
  proposed_work: "",
  approved_by: "",
  approval_signature: "",
  files: [],
  captions: {},
  folders: [],
};
const emptyVisitNoteForm = { id: "", visit_id: "", note_text: "", files: [], captions: {} };

function makePhotoFolder(index = 1) {
  return { id: `folder-${Date.now()}-${index}`, name: "", description: "", files: [], captions: {} };
}

function fieldReportFormHasDraft(form = {}) {
  return (
    String(form.description ?? "").trim().length > 0 ||
    String(form.proposed_work ?? "").trim().length > 0 ||
    String(form.approved_by ?? "").trim().length > 0 ||
    String(form.approval_signature ?? "").trim().length > 0 ||
    (form.files?.length ?? 0) > 0 ||
    Object.values(form.captions ?? {}).some((caption) => String(caption ?? "").trim().length > 0) ||
    (form.folders ?? []).some(
      (folder) =>
        String(folder.name ?? "").trim().length > 0 ||
        String(folder.description ?? "").trim().length > 0 ||
        (folder.files?.length ?? 0) > 0 ||
        Object.values(folder.captions ?? {}).some((caption) => String(caption ?? "").trim().length > 0),
    )
  );
}

function serializeProjectEditorForm(form) {
  return JSON.stringify({
    address: form.address ?? "",
    addresses: normalizeProjectAddresses(form).map((item) => ({ label: item.label ?? "", address: item.address ?? "" })),
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
    address: form.address ?? "",
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

function getPersonSafetyTokens(person) {
  return [person?.id, person?.full_name, person?.email, profileDisplayName(person, "")]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function compactSafetyIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function personHasSafetyFile(person, files = []) {
  const personId = String(person?.id || "").toLowerCase();
  const compactNames = [person?.full_name, profileDisplayName(person, ""), person?.email]
    .map(compactSafetyIdentity)
    .filter(Boolean);
  const safetyFiles = files.filter((file) => file.file_type === "safety_form");
  return safetyFiles.some((file) => {
    const searchText = String(file.search_text || "").toLowerCase();
    if (personId && searchText.includes(personId)) return true;

    const fileName = compactSafetyIdentity(file.file_name);
    return compactNames.some((name) => fileName.includes(name));
  });
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

function addHoursToTime(value, hoursToAdd = 1) {
  const base = toHour(value);
  return toTimeValue(Math.min(23.75, base + hoursToAdd));
}

function formatDateTimeLabel(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: WINNIPEG_TIME_ZONE,
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

function compareDateValue(value, reference = getWinnipegDateValue()) {
  const date = String(value || "");
  const ref = String(reference || "");
  if (!date || !ref) return 0;
  if (date < ref) return -1;
  if (date > ref) return 1;
  return 0;
}

function isPastDate(value, reference = getWinnipegDateValue()) {
  return compareDateValue(value, reference) < 0;
}

function isFutureDate(value, reference = getWinnipegDateValue()) {
  return compareDateValue(value, reference) > 0;
}

function canStartPlannedVisit(visit, today = getWinnipegDateValue()) {
  return Boolean(visit?.status === "planned" && compareDateValue(visit.visit_date, today) === 0);
}

function canUseActiveVisitWorkflow(visit, today = getWinnipegDateValue()) {
  return Boolean(visit?.status === "on_site" && compareDateValue(visit.visit_date, today) <= 0);
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

function projectStatusClass(status) {
  return projectStatusMap[status] ? status : "planning";
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

function hashString(value) {
  return String(value || "")
    .split("")
    .reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
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

function normalizeProjectSearch(value) {
  return cleanSearchText(value).toLowerCase();
}

function projectPickerText(project) {
  return [project?.name, project?.job_number].filter(Boolean).join(" ");
}

function cleanDownloadFileName(value, fallback = "buildcore-files") {
  return (
    String(value || fallback)
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || fallback
  );
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

function ensureTrailingSlash(value = "") {
  return value.endsWith("/") ? value : `${value}/`;
}

function getAuthRedirectUrl() {
  return AUTH_REDIRECT_URL;
}

function getPasswordRecoveryRedirectUrl() {
  return PASSWORD_RECOVERY_REDIRECT_URL;
}

function getAuthUrlParams() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const read = (key) => searchParams.get(key) || hashParams.get(key) || "";
  return {
    accessToken: read("access_token"),
    code: read("code"),
    error: read("error"),
    errorDescription: read("error_description"),
    mode: read("mode"),
    refreshToken: read("refresh_token"),
    type: read("type"),
  };
}

function clearAuthUrlParams() {
  window.history.replaceState({}, document.title, `${window.location.origin}${window.location.pathname}`);
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
  const [monthDate, setMonthDate] = useState(value || getWinnipegDateValue());
  const fieldRef = useRef(null);
  const today = getWinnipegDateValue();

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

function ProjectSearchSelect({ onChange, projects = [], value }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const selectedProject = useMemo(() => projects.find((project) => project.id === value) ?? null, [projects, value]);
  const filteredProjects = useMemo(() => {
    const normalizedQuery = normalizeProjectSearch(query);
    if (!normalizedQuery) return [];
    const ranked = projects
      .map((project, index) => {
        const name = normalizeProjectSearch(project.name);
        const jobNumber = normalizeProjectSearch(project.job_number);
        const haystack = normalizeProjectSearch(projectPickerText(project));
        const matches = !normalizedQuery || haystack.includes(normalizedQuery);
        let score = 0;
        if (jobNumber === normalizedQuery) score += 50;
        if (jobNumber.startsWith(normalizedQuery)) score += 30;
        if (name.startsWith(normalizedQuery)) score += 20;
        if (name.includes(normalizedQuery)) score += 10;
        return { project, index, matches, score };
      })
      .filter((item) => item.matches)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    return ranked.slice(0, normalizedQuery ? 12 : 8).map((item) => item.project);
  }, [projects, query]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handlePointerDown(event) {
      if (wrapRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    setQuery("");
    setIsOpen(false);
  }, [value]);

  return (
    <div className="projectSearchSelect" ref={wrapRef}>
      <div className="projectSearchInputWrap">
        <Search size={17} />
        <input
          autoComplete="off"
          placeholder={selectedProject ? `${selectedProject.name}${selectedProject.job_number ? ` / ${selectedProject.job_number}` : ""}` : "Search project or job number"}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        <button aria-label="Show project search" type="button" onClick={() => setIsOpen((current) => !current)}>
          <ChevronDown size={16} />
        </button>
      </div>
      {selectedProject && (
        <div className="selectedProjectPreview">
          <span>Selected</span>
          <strong>{selectedProject.name}</strong>
          <em>{selectedProject.job_number || "No job number"}</em>
        </div>
      )}
      {isOpen && (
        <div className="projectSearchPopover" role="listbox">
          {query.trim() ? (
            filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <button
                  aria-selected={project.id === value}
                  className={project.id === value ? "projectSearchOption active" : "projectSearchOption"}
                  key={project.id}
                  type="button"
                  onClick={() => onChange(project.id)}
                >
                  <span>
                    <strong>{project.name}</strong>
                    <em>{project.job_number || "No job number"}</em>
                  </span>
                  {project.id === value && <CheckCircle2 size={18} />}
                </button>
              ))
            ) : (
              <div className="projectSearchEmpty">No projects found</div>
            )
          ) : (
            <div className="projectSearchEmpty">Start typing a project name or job number</div>
          )}
        </div>
      )}
    </div>
  );
}

function Avatar({ profile, small = false, url }) {
  const identity = profile?.id || profile?.email || profile?.full_name || "No Name";
  const avatarSeed = hashString(identity);
  const selectedEmoji = !url ? String(profile?.avatar_emoji || "").trim() : "";
  const defaultEmoji = !url && !selectedEmoji ? defaultProfileAvatarOptions[avatarSeed % defaultProfileAvatarOptions.length] : "";
  const emoji = selectedEmoji || defaultEmoji;
  const avatarClasses = [
    "avatar",
    "face",
    small ? "small" : "",
    emoji ? "emoji" : "",
    `avatarVariant${avatarSeed % 6}`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={avatarClasses}>
      {url ? <img src={url} alt="" /> : emoji ? <span className="avatarEmoji">{emoji}</span> : makeInitials(profile?.full_name || profile?.email || "No Name", "NN")}
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
  const [selectedDate, setSelectedDate] = useState(getWinnipegDateValue());
  const [overviewDate, setOverviewDate] = useState(getWinnipegDateValue());
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [selectedSiteVisitId, setSelectedSiteVisitId] = useState("");
  const [selectedChangeOrderId, setSelectedChangeOrderId] = useState("");
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
  const [dictationBusyCount, setDictationBusyCount] = useState(0);
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authAvatarFile, setAuthAvatarFile] = useState(null);
  const [authAvatarEmoji, setAuthAvatarEmoji] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState("form");
  const [recoveryForm, setRecoveryForm] = useState({ password: "", confirm: "" });
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [viewerItems, setViewerItems] = useState([]);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [isAnnotatingPhoto, setIsAnnotatingPhoto] = useState(false);
  const [projectWeather, setProjectWeather] = useState({ status: "idle", address: "", data: null });
  const [modalType, setModalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState({});
  const [serverConnected, setServerConnected] = useState(Boolean(isSupabaseConfigured));
  const [activeEditLock, setActiveEditLock] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingEquipmentId, setEditingEquipmentId] = useState(null);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [editingSiteVisitId, setEditingSiteVisitId] = useState(null);
  const [editingChangeOrderId, setEditingChangeOrderId] = useState(null);
  const [companyForm, setCompanyForm] = useState({ company_name: "BuildCore Construction", full_name: "", phone: "" });
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [visitForm, setVisitForm] = useState(emptyVisitForm);
  const [siteVisitForm, setSiteVisitForm] = useState(emptySiteVisitForm);
  const [changeOrderForm, setChangeOrderForm] = useState(emptyChangeOrderForm);
  const [visitNoteForm, setVisitNoteForm] = useState(emptyVisitNoteForm);
  const [safetyForm, setSafetyForm] = useState({ responses: emptySafetyResponses(defaultSafetyTemplate), signatures: {}, presentIds: [] });
  const [workflowVisitId, setWorkflowVisitId] = useState("");
  const [photoStep, setPhotoStep] = useState({ kind: "", visitId: "", files: [], captions: {} });
  const [completionForm, setCompletionForm] = useState({ notes: "", files: [], captions: {} });
  const [uploadProgress, setUploadProgress] = useState(null);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", avatarFile: null, avatarEmoji: "", removeAvatar: false });
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [personForm, setPersonForm] = useState({ first_name: "", last_name: "", phone: "", role: "builder", trade: "", availability_status: "available" });
  const [featureFlags, setFeatureFlags] = useState(defaultFeatureFlags);
  const [developerForm, setDeveloperForm] = useState({ ...defaultFeatureFlags, botCount: "10" });
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAccountMenuClosing, setIsAccountMenuClosing] = useState(false);
  const [avatarUrls, setAvatarUrls] = useState({});
  const accountMenuRef = useRef(null);
  const authRedirectHandledRef = useRef(false);
  const offlineQueueProcessingRef = useRef(false);
  const reminderCheckRef = useRef("");

  const isLive = Boolean(session && profile?.is_active);
  const canManage = Boolean(profile?.is_active && ["owner", "project_manager", "office_manager"].includes(profile?.role));
  const canDeleteTickets = Boolean(profile?.is_active && profile?.role !== "builder");
  const activeFeatureFlags = normalizeFeatureFlags(featureFlags);
  const canUseDeveloperMode = Boolean(profile?.is_active && profile?.role !== "builder");
  const canCreateSiteInspections = Boolean(profile?.is_active && profile?.role !== "builder");
  const canCreateChangeOrders = Boolean(profile?.is_active);
  const visibleNavItems = navItems
    .filter((item) => !settingsNavIds.includes(item.id))
    .filter((item) => canManage || !["people", "equipment"].includes(item.id))
    .filter((item) => item.id !== "siteVisits" || canCreateSiteInspections)
    .filter((item) => item.id !== "changeOrders" || canCreateChangeOrders)
    .filter((item) => activeFeatureFlags.safetyForm || item.id !== "safetyReports")
    .filter((item) => activeFeatureFlags.siteInspections || item.id !== "siteVisits")
    .filter((item) => activeFeatureFlags.changeOrders || item.id !== "changeOrders");
  const currentUserName = profile?.full_name || session?.user?.email || "James Carter";
  const unreadNotifications = (data.notifications ?? []).filter((item) => !item.read_at);
  const dictationBusy = dictationBusyCount > 0;
  const companySaving = Boolean(actionBusy.company);
  const projectSaving = Boolean(actionBusy.project);
  const visitSaving = Boolean(actionBusy.visit);
  const siteVisitSaving = Boolean(actionBusy.siteVisit);
  const changeOrderSaving = Boolean(actionBusy.changeOrder);
  const safetyFormSaving = Boolean(actionBusy.safetyForm);
  const beforePhotosSaving = Boolean(actionBusy.beforePhotos);
  const completionSaving = Boolean(actionBusy.completion);
  const visitNoteSaving = Boolean(actionBusy.visitNote);
  const handleDictationBusyChange = useCallback((isBusy) => {
    setDictationBusyCount((count) => Math.max(0, count + (isBusy ? 1 : -1)));
  }, []);
  const dictation = useMemo(() => ({
    disabled: !isLive,
    onBusyChange: handleDictationBusyChange,
    onNotice: setNotice,
  }), [handleDictationBusyChange, isLive]);

  function preventSaveDuringDictation(event) {
    if (!dictationBusy) return false;
    event?.preventDefault?.();
    setNotice("Finish dictation before saving.");
    return true;
  }

  function setActionPending(key, pending) {
    setActionBusy((current) => {
      if (Boolean(current[key]) === pending) return current;
      if (!pending) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: true };
    });
  }

  async function refreshOfflineQueueCount() {
    if (!profile?.id || !rowsSource.companyId) {
      setOfflineQueueCount(0);
      return;
    }
    const count = await countOfflineOperations({ companyId: rowsSource.companyId, userId: profile.id });
    setOfflineQueueCount(count);
  }

  async function queueCompletionOffline({ completionNotes = "", files = [], visit, project }) {
    if (!profile?.id || !rowsSource.companyId || !visit?.id || !project?.id) {
      throw new Error("Cannot save offline without a signed-in user, project, and ticket.");
    }

    const queuedAt = new Date().toISOString();
    const assignedPeople = rowsSource.people.filter((person) => visit.people_ids?.includes(person.id));
    const officeOverride = canManage && isPastDate(visit.visit_date, getWinnipegDateValue()) && !visit.people_ids?.includes(profile.id);
    const filePayload = files.map((file) => ({
      caption: completionForm.captions?.[fileInputKey(file)]?.trim() || "",
      file,
      lastModified: file.lastModified || null,
      name: file.name || "after-photo.jpg",
      type: file.type || "image/jpeg",
    }));
    const operation = await enqueueOfflineOperation({
      type: "complete_visit",
      userId: profile.id,
      companyId: rowsSource.companyId,
      profileName: currentUserName,
      project: { id: project.id, name: project.name },
      visit: {
        id: visit.id,
        project_id: visit.project_id,
        visit_date: visit.visit_date,
        work_scope: visit.work_scope,
        people_ids: visit.people_ids ?? [],
      },
      completionNotes,
      officeOverride,
      onBehalfOf: assignedPeople.map((person) => ({ id: person.id, name: profileDisplayName(person, "Team member") })),
      files: filePayload,
      queuedAt,
    });

    commitWorkspaceData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) =>
        item.id === visit.id
          ? {
              ...item,
              status: "completed",
              completed_at: queuedAt,
              completion_notes: completionNotes,
              offline_queued: true,
            }
          : item,
      ),
    }));
    await refreshOfflineQueueCount();
    return operation;
  }

  async function processOfflineQueue() {
    if (offlineQueueProcessingRef.current || !supabase || !profile?.id || !rowsSource.companyId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    offlineQueueProcessingRef.current = true;
    try {
      const operations = await readOfflineOperations({ companyId: rowsSource.companyId, userId: profile.id });
      let processed = 0;
      for (const operation of operations) {
        if (operation.type !== "complete_visit") continue;
        const visit = (rowsSource.visits ?? []).find((item) => item.id === operation.visit?.id) ?? operation.visit;
        const project = (rowsSource.projects ?? []).find((item) => item.id === operation.project?.id) ?? operation.project;
        if (!visit?.id || !project?.id) continue;

        if ((operation.files?.length ?? 0) > 0) setUploadProgress({ current: 0, total: operation.files.length, label: "Offline after photos" });
        const uploadedRows = [];
        for (const [index, item] of (operation.files ?? []).entries()) {
          const alreadyUploaded = (rowsSource.files ?? []).some(
            (file) =>
              file.visit_id === visit.id &&
              file.file_type === "completion_photo" &&
              file.uploaded_by === profile.id &&
              file.file_name === item.name &&
              (file.photo_caption || "") === (item.caption || ""),
          );
          if (alreadyUploaded) {
            setUploadProgress({ current: index + 1, total: operation.files?.length ?? 0, label: "Offline after photos" });
            continue;
          }
          const row = await uploadVisitPhoto({
            companyId: operation.companyId,
            projectId: project.id,
            visitId: visit.id,
            profileId: profile.id,
            file: item.file,
            fileType: "completion_photo",
            photoCaption: item.caption,
            searchText: `After photo uploaded offline by ${operation.profileName || currentUserName} at ${operation.queuedAt}. ${operation.completionNotes || ""} ${item.caption || ""}`,
          });
          uploadedRows.push(row);
          setUploadProgress({ current: index + 1, total: operation.files?.length ?? 0, label: "Offline after photos" });
        }
        if (uploadedRows.length > 0) {
          commitWorkspaceData((current) => ({ ...current, files: [...uploadedRows, ...(current.files ?? [])] }));
          await logVisitActivity(visit, "after_photos_uploaded", `${operation.profileName || currentUserName} synced ${uploadedRows.length} offline after photo${uploadedRows.length === 1 ? "" : "s"}.`, {
            count: uploadedRows.length,
            queuedAt: operation.queuedAt,
            syncedAt: new Date().toISOString(),
          });
        }
        await updateVisitStatusById(visit.id, "completed", { completed_at: operation.queuedAt, completion_notes: operation.completionNotes || "" });
        const onBehalfNames = (operation.onBehalfOf ?? []).map((item) => item.name).filter(Boolean).join(", ") || "assigned crew";
        await logVisitActivity(visit, "completed", operation.officeOverride ? `${operation.profileName || currentUserName} closed this previous-day active ticket on behalf of ${onBehalfNames} from offline queue.` : `${operation.profileName || currentUserName} completed the visit from offline queue.`, {
          completedAt: operation.queuedAt,
          offlineQueuedAt: operation.queuedAt,
          syncedAt: new Date().toISOString(),
          officeOverride: Boolean(operation.officeOverride),
          onBehalfOf: operation.onBehalfOf ?? [],
          notes: operation.completionNotes || "",
        });
        await deleteOfflineOperation(operation.id);
        processed += 1;
        setNotice("Offline ticket changes synced to Supabase.");
      }
      await refreshOfflineQueueCount();
      if (processed > 0) await Promise.all([loadVisits(), loadActivities(), loadFiles()]);
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "processOfflineQueue" });
      setNotice("Offline changes are still saved on this device. They will retry when the connection is stable.");
    } finally {
      setUploadProgress(null);
      offlineQueueProcessingRef.current = false;
    }
  }

  async function runActiveTicketReminderCheck() {
    if (!supabase || !profile?.is_active || !profile.company_id) return;
    if (getWinnipegTimeValue() < "18:00") return;
    const cooldownKey = `${profile.company_id}:${getWinnipegDateValue()}:${Math.floor(Date.now() / (5 * 60 * 1000))}`;
    if (reminderCheckRef.current === cooldownKey) return;
    reminderCheckRef.current = cooldownKey;

    const { data: inserted, error } = await supabase.rpc("create_active_ticket_end_of_day_reminders");
    if (error) {
      if (error.code !== "42883" && error.code !== "PGRST202") console.warn("Active ticket reminder check failed", error);
      return;
    }
    if (Number(inserted) > 0) loadNotifications();
  }

  const errorContextRef = useRef({});
  const realtimeRefreshTimersRef = useRef({});
  useEffect(() => {
    errorContextRef.current = {
      companyId: profile?.company_id || data.companyId || "",
      profileId: profile?.id || "",
      role: profile?.role || "",
    };
  }, [data.companyId, profile]);

  useEffect(() => {
    function handleWindowError(event) {
      recordClientError(event.error || event.message, {
        ...errorContextRef.current,
        source: "window.error",
        metadata: {
          colno: event.colno,
          filename: event.filename,
          lineno: event.lineno,
        },
      });
    }

    function handleUnhandledRejection(event) {
      recordClientError(event.reason || "Unhandled promise rejection", {
        ...errorContextRef.current,
        source: "unhandledrejection",
      });
    }

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

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
            setServerConnected(true);
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
        setServerConnected(true);
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

      const [companyResult, projectsResult, peopleResult, equipmentResult, visitsResult, filesResult, activityResult, visitNotesResult, notificationsResult] = await Promise.all([
        supabase.from("companies").select("feature_flags").eq("id", nextProfile.company_id).single(),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        peopleQuery,
        supabase.from("equipment").select("*").order("name"),
        supabase.from("visit_schedule_view").select("*").order("visit_date", { ascending: false }).order("start_time"),
        supabase.from("visit_files").select("*").order("created_at", { ascending: false }),
        supabase.from("visit_activity").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("visit_notes").select("*").order("created_at", { ascending: false }),
        supabase.from("notifications").select("*").eq("recipient_id", nextProfile.id).order("created_at", { ascending: false }).limit(100),
      ]);

      const failed = [companyResult, projectsResult, peopleResult, equipmentResult, visitsResult, filesResult, activityResult].find((result) => result.error);
      if (failed) throw failed.error;
      if (visitNotesResult.error && visitNotesResult.error.code !== "42P01") throw visitNotesResult.error;
      if (notificationsResult.error && notificationsResult.error.code !== "42P01") throw notificationsResult.error;

      const nextProjects = projectsResult.data ?? [];
      const allPeople = peopleResult.data ?? [];
      const [siteVisitsResult, changeOrdersResult] = await Promise.all([
        supabase.from("site_visits").select("*").order("visit_date", { ascending: false }).order("start_time"),
        supabase.from("change_orders").select("*").order("order_date", { ascending: false }).order("order_time"),
      ]);
      if (siteVisitsResult.error && siteVisitsResult.error.code !== "42P01") throw siteVisitsResult.error;
      if (changeOrdersResult.error && changeOrdersResult.error.code !== "42P01") throw changeOrdersResult.error;
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
        siteVisits: siteVisitsResult.data ?? [],
        changeOrders: changeOrdersResult.data ?? [],
        files: filesResult.data ?? [],
        activities: activityResult.data ?? [],
        visitNotes: visitNotesResult.error?.code === "42P01" ? [] : visitNotesResult.data ?? [],
        notifications: notificationsResult.error?.code === "42P01" ? [] : notificationsResult.data ?? [],
      };
      setData(nextData);
      setServerConnected(true);
      scheduleWorkspaceCacheWrite(session.user.id, { profile: nextProfile, data: nextData });

      if (selectedProjectId && !nextProjects.some((project) => project.id === selectedProjectId)) setSelectedProjectId("");
    } catch (error) {
      setServerConnected(false);
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, session]);

  useEffect(() => {
    if (!supabase) return undefined;

    let cancelled = false;

    async function initializeAuth() {
      const recoverySession = await handleAuthRedirectFromUrl();
      if (cancelled) return;
      const { data: authData } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(recoverySession ?? authData.session);
      setAuthReady(true);
    }

    initializeAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        setRecoveryForm({ password: "", confirm: "" });
        setModalType("passwordRecovery");
        setNotice("Create a new password to continue.");
      }
      setSession((currentSession) => {
        const currentUserId = currentSession?.user?.id || "";
        const nextUserId = nextSession?.user?.id || "";
        if (!nextSession || event === "SIGNED_OUT") {
          setProfile(null);
        } else if (currentUserId && nextUserId && currentUserId !== nextUserId) {
          setProfile(null);
        }
        return nextSession;
      });
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.querySelector(".sideNavItem.active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeNav]);

  useEffect(() => {
    if ((activeNav === "people" || activeNav === "equipment") && !canManage) setActiveNav("overview");
    if (activeNav === "safetyReports" && !activeFeatureFlags.safetyForm) setActiveNav("overview");
    if (activeNav === "siteVisits" && (!activeFeatureFlags.siteInspections || !canCreateSiteInspections)) setActiveNav("overview");
    if (activeNav === "changeOrders" && (!activeFeatureFlags.changeOrders || !canCreateChangeOrders)) setActiveNav("overview");
  }, [activeFeatureFlags.changeOrders, activeFeatureFlags.safetyForm, activeFeatureFlags.siteInspections, activeNav, canCreateChangeOrders, canCreateSiteInspections, canManage]);

  useEffect(() => {
    if (!activeFeatureFlags.siteInspections && (modalType === "siteVisit" || detailOverlay === "siteVisit")) {
      setModalType(null);
      clearDetailOverlay();
    }
    if (!activeFeatureFlags.changeOrders && (modalType === "changeOrder" || detailOverlay === "changeOrder")) {
      setModalType(null);
      clearDetailOverlay();
    }
  }, [activeFeatureFlags.changeOrders, activeFeatureFlags.siteInspections, detailOverlay, modalType]);

  useEffect(() => {
    if (!isAccountMenuOpen) return undefined;
    function handlePointerDown(event) {
      if (accountMenuRef.current?.contains(event.target)) return;
      closeAccountMenuAnimated();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isAccountMenuOpen]);

  function closeAccountMenuAnimated() {
    if (!isAccountMenuOpen) return 0;
    setIsAccountMenuOpen(false);
    setIsAccountMenuClosing(true);
    window.setTimeout(() => setIsAccountMenuClosing(false), 190);
    return 190;
  }

  function closeMenusThen(action) {
    const accountDelay = closeAccountMenuAnimated();
    window.setTimeout(() => {
      const drawerDelay = isMobileMenuOpen ? 330 : 0;
      setIsMobileMenuOpen(false);
      window.setTimeout(action, drawerDelay);
    }, accountDelay);
  }

  useEffect(() => {
    if (!session || isPasswordRecovery) return;
    refreshData();
  }, [isPasswordRecovery, refreshData, session]);

  useEffect(() => {
    if (!profile) return;
    const [first = "", ...rest] = String(profile.full_name || "").split(" ").filter(Boolean);
    setProfileForm({
      first_name: profile.first_name || first,
      last_name: profile.last_name || rest.join(" "),
      phone: profile.phone || "",
      avatarFile: null,
      avatarEmoji: profile.avatar_emoji || "",
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

    function scheduleRealtimeLoad(key, loader, delay = 350) {
      if (realtimeRefreshTimersRef.current[key]) window.clearTimeout(realtimeRefreshTimersRef.current[key]);
      realtimeRefreshTimersRef.current[key] = window.setTimeout(() => {
        realtimeRefreshTimersRef.current[key] = null;
        loader();
      }, delay);
    }

    const channel = supabase
      .channel(`buildcore-workspace-${profile.company_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "companies", filter: `id=eq.${profile.company_id}` }, (payload) => {
        const nextFeatureFlags = normalizeFeatureFlags(payload.new?.feature_flags);
        setFeatureFlags(nextFeatureFlags);
        setData((current) => ({ ...current, featureFlags: nextFeatureFlags }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visits", filter: `company_id=eq.${profile.company_id}` }, () => {
        scheduleRealtimeLoad("visits", () => void loadVisits());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visits", filter: `company_id=eq.${profile.company_id}` }, () => {
        scheduleRealtimeLoad("siteVisits", () => void loadSiteVisits());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "change_orders", filter: `company_id=eq.${profile.company_id}` }, () => {
        scheduleRealtimeLoad("changeOrders", () => void loadChangeOrders());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_people" }, () => {
        scheduleRealtimeLoad("visits", () => void loadVisits());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_equipment" }, () => {
        scheduleRealtimeLoad("visits", () => void loadVisits());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_activity", filter: `company_id=eq.${profile.company_id}` }, () => {
        scheduleRealtimeLoad("activities", () => void loadActivities());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_notes", filter: `company_id=eq.${profile.company_id}` }, () => {
        scheduleRealtimeLoad("visitNotes", () => void loadVisitNotes());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${profile.id}` }, () => {
        scheduleRealtimeLoad("notifications", () => void loadNotifications());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "visit_files", filter: `company_id=eq.${profile.company_id}` }, () => {
        scheduleRealtimeLoad("files", () => void loadFiles());
      })
      .subscribe();

    return () => {
      Object.values(realtimeRefreshTimersRef.current).forEach((timerId) => {
        if (timerId) window.clearTimeout(timerId);
      });
      realtimeRefreshTimersRef.current = {};
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, profile?.id, profile?.is_active]);

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
    if (query.length < 1) {
      setSearchResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      const localResults = filterResultsByFeatures(localGlobalSearch({ ...data, visits: liveAssignments }, query), activeFeatureFlags);
      if (supabase && session && profile) {
        const { data: results, error } = await supabase.rpc("global_search", { search_query: query });
        if (!error) {
          const merged = new Map();
          [...localResults, ...filterResultsByFeatures(results ?? [], activeFeatureFlags)].forEach((result) => merged.set(result.id, result));
          setSearchResults([...merged.values()].slice(0, 12));
          return;
        }
      }

      setSearchResults(localResults);
    }, 160);

    return () => window.clearTimeout(handle);
  }, [activeFeatureFlags.changeOrders, activeFeatureFlags.siteInspections, data, liveAssignments, profile, searchQuery, session]);

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
    if (!selectedAttachment) return undefined;
    const isInsideAttachmentViewer = (target) => target instanceof Element && Boolean(target.closest(".attachmentModal"));
    const preventViewerPageZoom = (event) => {
      if (!isInsideAttachmentViewer(event.target)) return;
      event.preventDefault();
    };
    const preventMultiTouchZoom = (event) => {
      if (event.touches?.length < 2 || !isInsideAttachmentViewer(event.target)) return;
      event.preventDefault();
    };
    const preventTrackpadPageZoom = (event) => {
      if (!event.ctrlKey || !isInsideAttachmentViewer(event.target)) return;
      event.preventDefault();
    };

    document.addEventListener("gesturestart", preventViewerPageZoom, { passive: false });
    document.addEventListener("gesturechange", preventViewerPageZoom, { passive: false });
    document.addEventListener("gestureend", preventViewerPageZoom, { passive: false });
    document.addEventListener("touchmove", preventMultiTouchZoom, { passive: false });
    document.addEventListener("wheel", preventTrackpadPageZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventViewerPageZoom);
      document.removeEventListener("gesturechange", preventViewerPageZoom);
      document.removeEventListener("gestureend", preventViewerPageZoom);
      document.removeEventListener("touchmove", preventMultiTouchZoom);
      document.removeEventListener("wheel", preventTrackpadPageZoom);
    };
  }, [selectedAttachment]);

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
  const projectById = useMemo(() => new Map((rowsSource.projects ?? []).map((project) => [project.id, project])), [rowsSource.projects]);
  const equipmentById = useMemo(() => new Map((rowsSource.equipment ?? []).map((item) => [item.id, item])), [rowsSource.equipment]);
  const assignmentsByPerson = useMemo(() => {
    const grouped = new Map();
    (assignmentsSource ?? []).forEach((item) => {
      if (item.type !== "person") return;
      const list = grouped.get(item.resourceId) ?? [];
      list.push(item);
      grouped.set(item.resourceId, list);
    });
    return grouped;
  }, [assignmentsSource]);
  const assignmentsByEquipment = useMemo(() => {
    const grouped = new Map();
    (assignmentsSource ?? []).forEach((item) => {
      if (item.type !== "equipment") return;
      const list = grouped.get(item.resourceId) ?? [];
      list.push(item);
      grouped.set(item.resourceId, list);
    });
    return grouped;
  }, [assignmentsSource]);
  const getProfileName = useCallback((id, fallback = "Not set") => profileDisplayName(profileById.get(id), fallback), [profileById]);
  const selectedProject = useMemo(() => (selectedProjectId ? projectById.get(selectedProjectId) ?? null : null), [projectById, selectedProjectId]);
  const selectedAssignment = useMemo(() => assignmentsSource.find((item) => item.id === selectedAssignmentId) ?? null, [assignmentsSource, selectedAssignmentId]);
  const selectedProjectVisits = useMemo(
    () =>
      selectedProject
        ? (rowsSource.visits ?? [])
            .filter((visit) => visit.project_id === selectedProject.id)
            .sort((a, b) => `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`))
        : [],
    [rowsSource.visits, selectedProject],
  );
  const selectedProjectSiteVisits = useMemo(
    () =>
      selectedProject
        ? (rowsSource.siteVisits ?? [])
            .filter((item) => activeFeatureFlags.siteInspections && item.project_id === selectedProject.id)
            .sort((a, b) => `${a.visit_date} ${a.start_time}`.localeCompare(`${b.visit_date} ${b.start_time}`))
        : [],
    [activeFeatureFlags.siteInspections, rowsSource.siteVisits, selectedProject],
  );
  const selectedProjectChangeOrders = useMemo(
    () =>
      selectedProject
        ? (rowsSource.changeOrders ?? [])
            .filter((item) => activeFeatureFlags.changeOrders && item.project_id === selectedProject.id)
            .sort((a, b) => `${a.order_date} ${a.order_time}`.localeCompare(`${b.order_date} ${b.order_time}`))
        : [],
    [activeFeatureFlags.changeOrders, rowsSource.changeOrders, selectedProject],
  );
  const selectedVisit = useMemo(() => (selectedVisitId ? selectedProjectVisits.find((visit) => visit.id === selectedVisitId) ?? null : null), [selectedProjectVisits, selectedVisitId]);
  const selectedSiteVisit = useMemo(() => (selectedSiteVisitId ? (rowsSource.siteVisits ?? []).find((item) => item.id === selectedSiteVisitId) ?? null : null), [rowsSource.siteVisits, selectedSiteVisitId]);
  const selectedChangeOrder = useMemo(() => (selectedChangeOrderId ? (rowsSource.changeOrders ?? []).find((item) => item.id === selectedChangeOrderId) ?? null : null), [rowsSource.changeOrders, selectedChangeOrderId]);
  const currentVisit = selectedVisit ?? selectedProjectVisits[0] ?? null;
  const currentVisitFiles = useMemo(() => (rowsSource.files ?? []).filter((file) => currentVisit?.id && file.visit_id === currentVisit.id), [currentVisit?.id, rowsSource.files]);
  const currentVisitNotes = useMemo(() => getVisitNotes(currentVisit), [currentVisit, rowsSource.visitNotes]);
  const selectedSiteVisitFiles = useMemo(() => (rowsSource.files ?? []).filter((file) => selectedSiteVisit?.id && file.site_visit_id === selectedSiteVisit.id), [rowsSource.files, selectedSiteVisit?.id]);
  const selectedChangeOrderFiles = useMemo(() => (rowsSource.files ?? []).filter((file) => selectedChangeOrder?.id && file.change_order_id === selectedChangeOrder.id), [rowsSource.files, selectedChangeOrder?.id]);
  const currentVisitPeople = useMemo(() => (currentVisit ? (currentVisit.people_ids ?? []).map((id) => profileById.get(id)).filter(Boolean) : []), [currentVisit, profileById]);
  const currentVisitEquipment = useMemo(() => (currentVisit ? (currentVisit.equipment_ids ?? []).map((id) => equipmentById.get(id)).filter(Boolean) : []), [currentVisit, equipmentById]);
  const selectedProjectActivities = useMemo(() => (selectedProject ? (rowsSource.activities ?? []).filter((item) => item.project_id === selectedProject.id) : []), [rowsSource.activities, selectedProject]);
  const workflowVisit = useMemo(() => (workflowVisitId ? (rowsSource.visits ?? []).find((visit) => visit.id === workflowVisitId) ?? currentVisit : currentVisit), [currentVisit, rowsSource.visits, workflowVisitId]);
  const workflowProject = useMemo(() => (workflowVisit ? projectById.get(workflowVisit.project_id) ?? selectedProject : selectedProject), [projectById, selectedProject, workflowVisit]);
  const workflowPeople = useMemo(() => (workflowVisit ? (workflowVisit.people_ids ?? []).map((id) => profileById.get(id)).filter(Boolean) : currentVisitPeople), [currentVisitPeople, profileById, workflowVisit]);
  const selectedPerson = useMemo(() => (selectedPersonId ? [...(rowsSource.people ?? []), ...(rowsSource.pendingPeople ?? [])].find((person) => person.id === selectedPersonId) : null), [rowsSource.pendingPeople, rowsSource.people, selectedPersonId]);
  const todayValue = getWinnipegDateValue();
  const overviewVisits = useMemo(
    () =>
      (rowsSource.visits ?? [])
        .filter((visit) => visit.visit_date === overviewDate && (!isLive || visit.people_ids?.includes(profile?.id)))
        .sort((a, b) => {
          const statusOrder = { on_site: 0, planned: 1, completed: 2, cancelled: 3 };
          return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4) || String(a.start_time).localeCompare(String(b.start_time));
        }),
    [isLive, overviewDate, profile?.id, rowsSource.visits],
  );
  const projectAttachments = useMemo(
    () => (rowsSource.files ?? []).filter((file) => selectedProject && (file.project_id === selectedProject.id || file.projectId === selectedProject.id) && !file.visit_id && !file.site_visit_id && !file.change_order_id),
    [rowsSource.files, selectedProject],
  );

  const selectedProjectPrimaryAddress = primaryProjectAddress(selectedProject);

  useEffect(() => {
    if (!isLive) {
      setOfflineQueueCount(0);
      return undefined;
    }

    void refreshOfflineQueueCount();
    const handleOnline = () => {
      void processOfflineQueue();
    };
    window.addEventListener("online", handleOnline);
    const interval = window.setInterval(handleOnline, 15000);
    handleOnline();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.clearInterval(interval);
    };
  }, [isLive, profile?.id, rowsSource.companyId, rowsSource.projects, rowsSource.visits]);

  useEffect(() => {
    if (!isLive) return undefined;
    const check = () => {
      void runActiveTicketReminderCheck();
    };
    check();
    const interval = window.setInterval(check, 60000);
    return () => window.clearInterval(interval);
  }, [isLive, profile?.company_id, profile?.id, rowsSource.visits]);

  useEffect(() => {
    let alive = true;
    const address = selectedProjectPrimaryAddress;

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
  }, [selectedProjectPrimaryAddress]);

  const peopleRows = useMemo(
    () =>
      rowsSource.people.map((person) => ({
        ...person,
        kind: "person",
        subtitle: roleLabel(person.role),
        resourceStatus: getPersonWorkStatus({ date: selectedDate, person: person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
        peopleStatus: getPersonWorkStatus({ date: todayValue, person: person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
        assignments: assignmentsByPerson.get(person.id) ?? [],
      })),
    [assignmentsByPerson, rowsSource.people, rowsSource.projects, rowsSource.visits, selectedDate, todayValue],
  );

  const equipmentRows = useMemo(
    () =>
      rowsSource.equipment.map((equipment) => ({
        ...equipment,
        kind: "equipment",
        full_name: equipment.name,
        subtitle: equipment.type,
        resourceStatus: getEquipmentWorkStatus({ date: selectedDate, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
        assignments: assignmentsByEquipment.get(equipment.id) ?? [],
      })),
    [assignmentsByEquipment, rowsSource.equipment, rowsSource.projects, rowsSource.visits, selectedDate],
  );
  const projectRows = useMemo(
    () =>
      rowsSource.projects
        .map((project, index) => {
          const projectVisits = (rowsSource.visits ?? [])
            .filter((visit) => visit.project_id === project.id && visit.visit_date === selectedDate && visit.status !== "cancelled")
            .sort((a, b) => `${a.start_time} ${a.end_time}`.localeCompare(`${b.start_time} ${b.end_time}`));
          const projectSiteVisits = (rowsSource.siteVisits ?? [])
            .filter((item) => activeFeatureFlags.siteInspections && item.project_id === project.id && item.visit_date === selectedDate && item.status !== "cancelled")
            .map((item) => ({
              ...item,
              id: `siteVisit-${item.id}`,
              sourceId: item.id,
              sourceType: "siteVisit",
              start_time: item.status === "completed" && item.completed_at ? addHoursToTime(getWinnipegTimeValue(new Date(item.completed_at)), -1) : item.start_time,
              end_time: item.status === "completed" && item.completed_at ? getWinnipegTimeValue(new Date(item.completed_at)) : item.end_time,
            }));
          const projectScheduleItems = [...projectVisits, ...projectSiteVisits].sort((a, b) => `${a.start_time} ${a.end_time}`.localeCompare(`${b.start_time} ${b.end_time}`));
          const visitLanes = packVisitLanes(projectScheduleItems);
          return {
            ...project,
            kind: "project",
            full_name: project.name,
            subtitle: project.job_number || primaryProjectAddress(project),
            color: colors[index % colors.length],
            laneCount: visitLanes.laneCount,
            assignments: projectScheduleItems.map((item) => {
              const isSiteVisit = item.sourceType === "siteVisit";
              return {
                id: isSiteVisit ? item.id : `visit-${item.id}`,
                visitId: isSiteVisit ? "" : item.id,
                projectId: item.project_id,
                recordId: item.sourceId ?? item.id,
                recordType: item.sourceType ?? "visit",
                title: project.name,
                subtitle: isSiteVisit ? getFieldReportLabel("siteVisit") : item.work_scope || normalizeVisitStatus(item.status),
                start: toHour(item.start_time),
                end: toHour(item.end_time),
                timeText: formatTimeRange(item.start_time, item.end_time),
                status: item.status,
                isFirstVisit: item.is_first_visit,
                color: isSiteVisit ? "green" : colors[index % colors.length],
                people: isSiteVisit ? [profileById.get(item.created_by)].filter(Boolean) : (item.people_ids ?? []).map((id) => profileById.get(id)).filter(Boolean),
                equipment: [],
                laneIndex: visitLanes.laneByVisitId.get(item.id) ?? 0,
                laneCount: visitLanes.laneCount,
              };
            }),
          };
        })
        .filter((project) => project.assignments.length > 0),
    [activeFeatureFlags.siteInspections, profileById, rowsSource.projects, rowsSource.siteVisits, rowsSource.visits, selectedDate],
  );
  const availableTodayPeople = useMemo(
    () => rowsSource.people.filter((person) => getPersonWorkStatus({ date: selectedDate, person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }).tone === "available"),
    [rowsSource.people, rowsSource.projects, rowsSource.visits, selectedDate],
  );
  const availableTodayEquipment = useMemo(
    () => rowsSource.equipment.filter((equipment) => getEquipmentWorkStatus({ date: selectedDate, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }).tone === "available"),
    [rowsSource.equipment, rowsSource.projects, rowsSource.visits, selectedDate],
  );
  const visitPickerPeople = useMemo(
    () =>
      rowsSource.people.map((person) => ({
        ...person,
        pickerStatus: getPersonWorkStatus({ date: visitForm.visit_date, person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
      })),
    [rowsSource.people, rowsSource.projects, rowsSource.visits, visitForm.visit_date],
  );
  const visitPickerEquipment = useMemo(
    () =>
      rowsSource.equipment.map((equipment) => ({
        ...equipment,
        pickerStatus: getEquipmentWorkStatus({ date: visitForm.visit_date, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
      })),
    [rowsSource.equipment, rowsSource.projects, rowsSource.visits, visitForm.visit_date],
  );
  const visitFormProject = useMemo(() => projectById.get(visitForm.project_id) ?? null, [projectById, visitForm.project_id]);
  const visitProjectAddressOptions = useMemo(() => getProjectAddressOptions(visitFormProject), [visitFormProject]);
  const groupedVisitPickerPeople = useMemo(
    () =>
      tradeGroups
        .map((trade) => ({ trade, people: visitPickerPeople.filter((person) => person.trade === trade) }))
        .concat([{ trade: unassignedTradeLabel, people: visitPickerPeople.filter((person) => !tradeGroups.includes(person.trade)) }])
        .filter((group) => group.people.length > 0),
    [visitPickerPeople],
  );
  const visitFormDates = useMemo(() => (editingVisitId ? [visitForm.visit_date] : collectVisitDates(visitForm.visit_date, Math.max(1, parseWorkDayCount(visitForm.duration_days)))), [editingVisitId, visitForm.duration_days, visitForm.visit_date]);
  const visitWorkScopes = useMemo(() => normalizeWorkScopes(visitForm.work_scopes, visitFormDates.length, visitForm.work_scope), [visitForm.work_scope, visitForm.work_scopes, visitFormDates.length]);
  const safetyFormHasDraft =
    Object.values(safetyForm.responses ?? {}).some((value) => JSON.stringify(value ?? "").replace(/[{}\[\]":,]/g, "").trim().length > 0) ||
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

  function notificationRecipients({ builderIds = [], includeActor = false, managers = false } = {}) {
    const recipients = new Map();
    if (managers) {
      (rowsSource.people ?? [])
        .filter((person) => person.is_active && person.role !== "builder")
        .forEach((person) => recipients.set(person.id, person));
    }
    builderIds.forEach((id) => {
      const person = rowsSource.people.find((item) => item.id === id);
      if (person?.is_active && person.role === "builder") recipients.set(person.id, person);
    });
    if (!includeActor) recipients.delete(profile?.id);
    return [...recipients.keys()];
  }

  async function createNotifications({ builderIds = [], changeOrderId = null, includeActor = false, message, managers = false, projectId = null, title, type, visitId = null }) {
    if (!supabase || !profile?.company_id) return;
    const recipientIds = notificationRecipients({ builderIds, includeActor, managers });
    if (recipientIds.length === 0) return;
    const rows = recipientIds.map((recipientId) => ({
      actor_id: profile.id,
      change_order_id: changeOrderId,
      company_id: profile.company_id,
      message,
      project_id: projectId,
      recipient_id: recipientId,
      title,
      type,
      visit_id: visitId,
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (error && error.code !== "42P01") console.warn("Notification insert failed", error);
  }

  async function openNotifications() {
    setModalType("notifications");
    if (!supabase || !profile?.id || unreadNotifications.length === 0) return;
    const readAt = new Date().toISOString();
    const unreadIds = unreadNotifications.map((item) => item.id);
    commitWorkspaceData((current) => ({
      ...current,
      notifications: (current.notifications ?? []).map((item) => (unreadIds.includes(item.id) ? { ...item, read_at: readAt } : item)),
    }));
    const { error } = await supabase.from("notifications").update({ read_at: readAt }).in("id", unreadIds).eq("recipient_id", profile.id);
    if (error && error.code !== "42P01") {
      setNotice(error.message);
      loadNotifications();
    }
  }

  function resolveConfirmation(value) {
    const resolver = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setConfirmation(null);
    resolver?.(value);
  }

  async function handleAuthRedirectFromUrl() {
    if (authRedirectHandledRef.current) return null;
    const params = getAuthUrlParams();
    const isRecoveryUrl = params.mode === "recovery" || params.type === "recovery";
    if (!isRecoveryUrl) return null;
    authRedirectHandledRef.current = true;

    setIsPasswordRecovery(true);
    setRecoveryForm({ password: "", confirm: "" });
    setModalType("passwordRecovery");

    if (params.error) {
      clearAuthUrlParams();
      setNotice(params.errorDescription || "This reset link is expired or already used. Send a new reset link.");
      return null;
    }

    try {
      if (params.code) {
        const { data: authData, error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (error) throw error;
        clearAuthUrlParams();
        setNotice("Create a new password to continue.");
        return authData.session ?? null;
      }

      if (params.accessToken && params.refreshToken) {
        const { data: authData, error } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (error) throw error;
        clearAuthUrlParams();
        setNotice("Create a new password to continue.");
        return authData.session ?? null;
      }

      setNotice("Create a new password to continue.");
      return null;
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "handlePasswordRecoveryUrl" });
      clearAuthUrlParams();
      setNotice(error.message || "Password reset link could not be opened. Send a new reset link.");
      return null;
    }
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
      if (session?.user?.id && profile?.id && nextData?.companyId) scheduleWorkspaceCacheWrite(session.user.id, { profile, data: nextData });
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
      setServerConnected(true);
    } catch (error) {
      setServerConnected(false);
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
      setServerConnected(true);
    } catch (error) {
      setServerConnected(false);
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
      setServerConnected(true);
    } catch (error) {
      setServerConnected(false);
      setNotice(error.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadVisitNotes({ quiet = true } = {}) {
    if (!supabase || !session) return;
    if (!quiet) setLoading(true);
    try {
      const { data: visitNotes, error } = await supabase.from("visit_notes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, visitNotes: visitNotes ?? [] }));
      setServerConnected(true);
    } catch (error) {
      if (error.code !== "42P01") {
        setServerConnected(false);
        setNotice(error.message);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadNotifications({ quiet = true } = {}) {
    if (!supabase || !session || !profile?.id) return;
    if (!quiet) setLoading(true);
    try {
      const { data: notifications, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, notifications: notifications ?? [] }));
      setServerConnected(true);
    } catch (error) {
      if (error.code !== "42P01") {
        setServerConnected(false);
        setNotice(error.message);
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadSiteVisits({ quiet = true } = {}) {
    if (!supabase || !session) return;
    if (!quiet) setLoading(true);
    try {
      const { data: siteVisits, error } = await supabase.from("site_visits").select("*").order("visit_date", { ascending: false }).order("start_time");
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, siteVisits: siteVisits ?? [] }));
      setServerConnected(true);
    } catch (error) {
      setServerConnected(false);
      setNotice(error.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadChangeOrders({ quiet = true } = {}) {
    if (!supabase || !session) return;
    if (!quiet) setLoading(true);
    try {
      const { data: changeOrders, error } = await supabase.from("change_orders").select("*").order("order_date", { ascending: false }).order("order_time");
      if (error) throw error;
      commitWorkspaceData((current) => ({ ...current, changeOrders: changeOrders ?? [] }));
      setServerConnected(true);
    } catch (error) {
      setServerConnected(false);
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
    const avatarEmoji = pending.avatarEmoji || "";

    if (pending.avatarDataUrl) {
      const avatarFile = await dataUrlToFile(pending.avatarDataUrl, pending.avatarName || "avatar.jpg", pending.avatarType || "image/jpeg");
      avatarPath = await uploadProfileAvatar({ companyId: nextProfile.company_id, profileId: nextProfile.id, file: avatarFile });
    }

    if (firstName || lastName || phone || avatarPath || avatarEmoji) {
      await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim() || nextProfile.full_name,
          email: session.user.email,
          phone,
          avatar_path: avatarPath,
          avatar_emoji: avatarPath ? null : avatarEmoji || null,
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
        avatarEmoji: authAvatarFile ? "" : authAvatarEmoji,
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
              data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim(), phone, avatar_emoji: authAvatarFile ? "" : authAvatarEmoji },
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

  async function sendPasswordReset(event) {
    event.preventDefault();
    if (!supabase) return;
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setNotice("Enter your email first.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getPasswordRecoveryRedirectUrl(),
    });
    setLoading(false);

    if (error) {
      recordClientError(error, { ...errorContextRef.current, source: "sendPasswordReset" });
      setNotice(error.message);
      return;
    }

    setForgotStep("sent");
    setNotice("If this email exists, reset instructions were sent.");
  }

  async function saveRecoveredPassword(event) {
    event.preventDefault();
    if (!supabase) return;
    const password = recoveryForm.password.trim();
    const confirm = recoveryForm.confirm.trim();
    if (password.length < 8) {
      setNotice("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setNotice("Passwords do not match.");
      return;
    }

    setLoading(true);
    setNotice("Updating password...");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      recordClientError(error, { ...errorContextRef.current, source: "saveRecoveredPassword" });
      setNotice(error.message);
      return;
    }

    setRecoveryForm({ password: "", confirm: "" });
    setIsPasswordRecovery(false);
    setModalType(null);
    setAuthMode("signin");
    setAuthPassword("");
    setNotice("Password updated.");
    refreshData();
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

    setActionPending("company", true);
    const { error } = await supabase.rpc("create_company_for_current_user", companyForm);
    setActionPending("company", false);

    if (error) {
      recordClientError(error, { ...errorContextRef.current, source: "createCompany" });
      setNotice(error.message);
      return;
    }

    setModalType(null);
    setNotice("Company created. You are Owner now.");
    refreshData();
  }

  async function saveProject(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
    if (!supabase || !profile) return;
    const jobNumber = String(projectForm.job_number || "").trim();
    if (!jobNumber) {
      setNotice("Enter a job number before saving.");
      return;
    }
    if (projectJobNumberExists(rowsSource.projects, jobNumber, editingProjectId)) {
      setNotice(`Project number ${jobNumber} already exists. Choose another number.`);
      return;
    }

    setActionPending("project", true);

    const payload = {
      job_number: jobNumber,
      name: projectForm.name,
      address: primaryProjectAddress(projectForm),
      addresses: normalizeProjectAddresses(projectForm).map((item) => ({ label: item.label, address: item.address })),
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
    setActionPending("project", false);

    if (error) {
      recordClientError(error, { ...errorContextRef.current, source: "saveProject" });
      setNotice(error.code === "23505" ? `Project number ${jobNumber} already exists. Choose another number.` : error.message);
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

  async function changeProjectStatus(project, nextStatus) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can change project status.");
      return;
    }
    if (!project?.id || project.status === nextStatus) return;

    const confirmed = await confirmAction({
      title: "Change project status?",
      message: `Set "${project.name}" to ${normalizeStatus(nextStatus)}?`,
      confirmLabel: "Change status",
    });
    if (!confirmed) {
      setNotice("Project status unchanged.");
      return;
    }

    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      projects: (current.projects ?? []).map((item) => (item.id === project.id ? { ...item, status: nextStatus } : item)),
    }));

    setLoading(true);
    try {
      const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", project.id);
      if (error) throw error;
      triggerSoftPulse();
      setNotice(`Project status changed to ${normalizeStatus(nextStatus)}.`);
    } catch (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
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
      address: primaryProjectAddress(project),
      addresses: normalizeProjectAddresses(project),
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
      siteVisits: (current.siteVisits ?? []).filter((item) => item.project_id !== project.id),
      changeOrders: (current.changeOrders ?? []).filter((item) => item.project_id !== project.id),
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
    if (preventSaveDuringDictation(event)) return;
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
      recordClientError(error, { ...errorContextRef.current, source: "saveEquipment" });
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
    if (preventSaveDuringDictation(event)) return;
    if (!supabase || !profile) return;

    const requestedWorkDays = editingVisitId ? 1 : parseWorkDayCount(visitForm.duration_days);
    if (!editingVisitId && requestedWorkDays < 1) {
      setNotice("Enter at least 1 work day before saving the visit.");
      return;
    }

    setActionPending("visit", true);
    const baseVisitPayload = {
      project_id: visitForm.project_id,
      address: visitForm.address || primaryProjectAddress(rowsSource.projects.find((project) => project.id === visitForm.project_id)),
      start_time: visitForm.start_time,
      end_time: visitForm.end_time,
    };

    const createdVisitIds = [];
    const generatedDates = editingVisitId ? [visitForm.visit_date] : collectVisitDates(visitForm.visit_date, requestedWorkDays);
    const workScopes = normalizeWorkScopes(visitForm.work_scopes, generatedDates.length, visitForm.work_scope).map((scope) => scope.trim());

    if (workScopes.some((scope) => !scope)) {
      setActionPending("visit", false);
      setNotice("Add a Work Scope for every scheduled work day.");
      return;
    }

    const notAvailablePeople = rowsSource.people.filter((person) => visitForm.people_ids.includes(person.id) && person.availability_status === "not_available");
    if (notAvailablePeople.length) {
      setActionPending("visit", false);
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
      setActionPending("visit", false);
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

      setActionPending("visit", false);
      const lockToRelease = activeEditLockRef.current;
      const resetProject = rowsSource.projects[0];
      setVisitForm({ ...emptyVisitForm, visit_date: selectedDate, project_id: resetProject?.id ?? "", address: primaryProjectAddress(resetProject) });
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
      void createNotifications({
        builderIds: visitForm.people_ids,
        message: editingVisitId
          ? `${currentUserName} updated your ticket on ${formatDateLabel(firstVisit.visit_date)}.`
          : `${currentUserName} assigned you to a new ticket on ${formatDateLabel(firstVisit.visit_date)}.`,
        projectId: firstVisit.project_id,
        title: editingVisitId ? "Ticket updated" : "New ticket assigned",
        type: editingVisitId ? "ticket_updated" : "ticket_assigned",
        visitId: firstVisit.id,
      });
      triggerSoftPulse();
      setNotice(
        editingVisitId
          ? "Ticket changes saved."
          : `${generatedDates.length} ticket${generatedDates.length === 1 ? "" : "s"} saved.${requestedWorkDays > 1 ? " Weekends skipped." : ""}`,
      );
      loadVisits();
    } catch (error) {
      if (!editingVisitId && createdVisitIds.length > 0) await supabase.from("visits").delete().in("id", createdVisitIds);
      setActionPending("visit", false);
      recordClientError(error, { ...errorContextRef.current, source: "saveVisit" });
      setNotice(error.message);
      loadVisits();
    }
  }

  async function saveSiteVisit(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
    if (!supabase || !profile || !canCreateSiteInspections) return;
    if (!activeFeatureFlags.siteInspections) {
      setNotice("Site Inspection is disabled in Developer mode.");
      return;
    }
    const project = rowsSource.projects.find((item) => item.id === siteVisitForm.project_id);
    if (!project) {
      setNotice("Select project before saving Site Inspection.");
      return;
    }

    setActionPending("siteVisit", true);
    setNotice("Saving Site Inspection...");
    try {
      const completedNow = new Date();
      const completedTime = getWinnipegTimeValue(completedNow);
      const savedStatus = siteVisitForm.status === "completed" ? "completed" : "planned";
      const payload = {
          company_id: rowsSource.companyId,
          project_id: project.id,
          visit_date: savedStatus === "completed" ? getWinnipegDateValue(completedNow) : siteVisitForm.visit_date,
          start_time: savedStatus === "completed" ? addHoursToTime(completedTime, -1) : siteVisitForm.start_time,
          end_time: savedStatus === "completed" ? completedTime : siteVisitForm.end_time,
          status: savedStatus,
          description: siteVisitForm.description.trim() || null,
          created_by: profile.id,
          completed_at: savedStatus === "completed" ? completedNow.toISOString() : null,
        };
      if (editingSiteVisitId) delete payload.created_by;

      const siteVisitQuery = editingSiteVisitId
        ? supabase.from("site_visits").update(payload).eq("id", editingSiteVisitId).select().single()
        : supabase.from("site_visits").insert(payload).select().single();
      const { data: saved, error } = await siteVisitQuery;
      if (error) throw error;

      await uploadFieldReportPhotos({
        description: siteVisitForm.description,
        files: siteVisitForm.files,
        captions: siteVisitForm.captions,
        folders: siteVisitForm.folders,
        label: "Site Inspection photos",
        project,
        siteVisitId: saved.id,
      });

      await logProjectActivity(project.id, editingSiteVisitId ? "site_inspection_updated" : "site_inspection_saved", `${currentUserName} ${editingSiteVisitId ? "updated" : "created"} Site Inspection.`, { siteVisitId: saved.id, status: saved.status });

      commitWorkspaceData((current) => {
        const kept = (current.siteVisits ?? []).filter((item) => item.id !== saved.id);
        return { ...current, siteVisits: [saved, ...kept] };
      });
      setSelectedProjectId(project.id);
      setSelectedSiteVisitId(saved.id);
      setEditingSiteVisitId(null);
      setSiteVisitForm({ ...emptySiteVisitForm, project_id: rowsSource.projects[0]?.id ?? "", visit_date: todayValue, files: [], captions: {}, folders: [] });
      setModalType(null);
      setUploadProgress(null);
      triggerSoftPulse();
      setNotice(editingSiteVisitId ? "Site Inspection changes saved." : "Site Inspection saved.");
      await Promise.all([loadSiteVisits(), loadFiles(), loadActivities()]);
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "saveSiteVisit" });
      setNotice(error.message);
    } finally {
      setActionPending("siteVisit", false);
      setUploadProgress(null);
    }
  }

  async function saveChangeOrder(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
    if (!supabase || !profile || !canCreateChangeOrders) return;
    if (!activeFeatureFlags.changeOrders) {
      setNotice("Change Order is disabled in Developer mode.");
      return;
    }
    const project = rowsSource.projects.find((item) => item.id === changeOrderForm.project_id);
    if (!project) {
      setNotice("Select project before saving Change Order.");
      return;
    }
    const changeOrderStatus = normalizeChangeOrderStatus(changeOrderForm.status);
    if (changeOrderStatus === "approved" && (!changeOrderForm.approved_by.trim() || !changeOrderForm.approval_signature)) {
      setNotice("Approved Change Order requires Approved by and digital signature.");
      return;
    }

    setActionPending("changeOrder", true);
    setNotice("Saving Change Order...");
    try {
      const createdNow = new Date();
      const orderNumber = changeOrderForm.order_number || nextChangeOrderNumber(project, rowsSource.changeOrders ?? []);
      const existing = editingChangeOrderId ? rowsSource.changeOrders.find((item) => item.id === editingChangeOrderId) : null;
      const payload = {
        project_id: project.id,
        status: changeOrderStatus,
        description: changeOrderForm.description.trim() || null,
        proposed_work: changeOrderForm.proposed_work.trim() || null,
        approved_by: changeOrderForm.approved_by.trim() || null,
        approval_signature: changeOrderForm.approval_signature || null,
        completed_at: changeOrderStatus === "approved" ? existing?.completed_at || createdNow.toISOString() : null,
      };
      const saveQuery = editingChangeOrderId
        ? supabase.from("change_orders").update(payload).eq("id", editingChangeOrderId).select().single()
        : supabase
            .from("change_orders")
            .insert({
              ...payload,
              company_id: rowsSource.companyId,
              order_number: orderNumber,
              order_date: getWinnipegDateValue(createdNow),
              order_time: getWinnipegTimeValue(createdNow),
              created_by: profile.id,
            })
            .select()
            .single();
      const { data: saved, error } = await saveQuery;
      if (error) throw error;

      await uploadFieldReportPhotos({
        changeOrderId: saved.id,
        description: changeOrderForm.description,
        proposedWork: changeOrderForm.proposed_work,
        files: changeOrderForm.files,
        captions: changeOrderForm.captions,
        folders: changeOrderForm.folders,
        label: "Change Order photos",
        project,
      });

      await logProjectActivity(project.id, editingChangeOrderId ? "change_order_updated" : "change_order_created", `${currentUserName} ${editingChangeOrderId ? "updated" : "created"} ${saved.order_number || orderNumber}.`, { changeOrderId: saved.id, orderNumber: saved.order_number || orderNumber, status: saved.status });
      if (!editingChangeOrderId) {
        void createNotifications({
          changeOrderId: saved.id,
          managers: true,
          message: `${currentUserName} created ${saved.order_number || orderNumber} for ${project.name}.`,
          projectId: project.id,
          title: "New Change Order",
          type: "change_order_created",
        });
      }
      commitWorkspaceData((current) => {
        const kept = (current.changeOrders ?? []).filter((item) => item.id !== saved.id);
        return { ...current, changeOrders: [saved, ...kept] };
      });
      setSelectedProjectId(project.id);
      setSelectedChangeOrderId(saved.id);
      setEditingChangeOrderId(null);
      setChangeOrderForm({ ...emptyChangeOrderForm, project_id: rowsSource.projects[0]?.id ?? "", order_date: todayValue, order_time: getWinnipegTimeValue(), files: [], captions: {}, folders: [] });
      setModalType(null);
      setUploadProgress(null);
      triggerSoftPulse();
      setNotice(editingChangeOrderId ? "Change Order changes saved." : "Change Order saved.");
      await Promise.all([loadChangeOrders(), loadFiles(), loadActivities()]);
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "saveChangeOrder" });
      setNotice(error.message);
    } finally {
      setActionPending("changeOrder", false);
      setUploadProgress(null);
    }
  }

  async function updateSiteVisitStatus(item, status) {
    if (!supabase || !item?.id || !canCreateSiteInspections) return;
    const completedNow = new Date();
    const completedTime = getWinnipegTimeValue(completedNow);
    const patch =
      status === "completed"
        ? {
            status,
            visit_date: getWinnipegDateValue(completedNow),
            start_time: addHoursToTime(completedTime, -1),
            end_time: completedTime,
            completed_at: completedNow.toISOString(),
          }
        : { status, completed_at: null };
    const { data: saved, error } = await supabase.from("site_visits").update(patch).eq("id", item.id).select().single();
    if (error) {
      setNotice(error.message);
      return;
    }
    commitWorkspaceData((current) => ({ ...current, siteVisits: (current.siteVisits ?? []).map((row) => (row.id === saved.id ? saved : row)) }));
    await logProjectActivity(saved.project_id, "site_inspection_completed", `${currentUserName} completed Site Inspection.`, { siteVisitId: saved.id });
    triggerSoftPulse();
    setNotice(status === "completed" ? "Site Inspection completed." : "Site Inspection updated.");
    loadActivities();
  }

  async function updateChangeOrderStatus(item, status) {
    if (!supabase || !item?.id || !canCreateChangeOrders) return;
    if (status === "approved" && (!item.approved_by || !item.approval_signature)) {
      setNotice("Open Change Order and add Approved by plus digital signature before approving.");
      return;
    }
    const patch = { status, completed_at: status === "approved" ? new Date().toISOString() : null };
    const { data: saved, error } = await supabase.from("change_orders").update(patch).eq("id", item.id).select().single();
    if (error) {
      setNotice(error.message);
      return;
    }
    commitWorkspaceData((current) => ({ ...current, changeOrders: (current.changeOrders ?? []).map((row) => (row.id === saved.id ? saved : row)) }));
    triggerSoftPulse();
    setNotice(status === "approved" ? "Change Order approved." : "Change Order marked requested.");
  }

  async function deleteSiteVisit(item) {
    if (!supabase || !item?.id || !canCreateSiteInspections) return;
    const confirmed = await confirmAction({
      title: "Delete Site Inspection?",
      message: "This removes the Site Inspection and its saved photos from the project view.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      siteVisits: (current.siteVisits ?? []).filter((row) => row.id !== item.id),
      files: (current.files ?? []).filter((file) => file.site_visit_id !== item.id),
    }));
    const { error } = await supabase.from("site_visits").delete().eq("id", item.id);
    if (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      return;
    }
    if (selectedSiteVisitId === item.id) setSelectedSiteVisitId("");
    if (detailOverlay === "siteVisit") closeDetailOverlay();
    triggerSoftPulse();
    setNotice("Site Inspection deleted.");
  }

  async function deleteChangeOrder(item) {
    if (!supabase || !item?.id || !canDeleteTickets) return;
    const confirmed = await confirmAction({
      title: "Delete Change Order?",
      message: "This removes the Change Order and its saved photos from the project view.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    const previousData = data;
    commitWorkspaceData((current) => ({
      ...current,
      changeOrders: (current.changeOrders ?? []).filter((row) => row.id !== item.id),
      files: (current.files ?? []).filter((file) => file.change_order_id !== item.id),
    }));
    const { error } = await supabase.from("change_orders").delete().eq("id", item.id);
    if (error) {
      commitWorkspaceData(previousData);
      setNotice(error.message);
      return;
    }
    if (selectedChangeOrderId === item.id) setSelectedChangeOrderId("");
    if (detailOverlay === "changeOrder") closeDetailOverlay();
    triggerSoftPulse();
    setNotice("Change Order deleted.");
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
      siteInspections: Boolean(developerForm.siteInspections),
      changeOrders: Boolean(developerForm.changeOrders),
      testBots: Boolean(developerForm.testBots),
      safetyTemplate: normalizeSafetyTemplate(developerForm.safetyTemplate),
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
      let avatarPath = profileForm.avatarEmoji ? null : profile.avatar_path || null;
      let avatarEmoji = profileForm.avatarEmoji || "";
      if (profileForm.removeAvatar) avatarPath = null;
      if (profileForm.avatarFile) {
        avatarPath = await uploadProfileAvatar({ companyId: profile.company_id, profileId: profile.id, file: profileForm.avatarFile });
        avatarEmoji = "";
      }
      if (profileForm.removeAvatar) avatarEmoji = "";

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          phone,
          avatar_path: avatarPath,
          avatar_emoji: avatarPath ? null : avatarEmoji || null,
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

  function getSafetyIdentityTokens(person) {
    return getPersonSafetyTokens(person);
  }

  function profileHasSafetyForVisit(visit, person = profile) {
    if (!activeFeatureFlags.safetyForm) return true;
    if (!visit?.people_ids?.includes(person?.id)) return true;
    return personHasSafetyFile(person, getVisitFiles(visit));
  }

  function visitActionsBlockedBySafety(visit) {
    return Boolean(activeFeatureFlags.safetyForm && visit?.status === "on_site" && visit?.people_ids?.includes(profile?.id) && !profileHasSafetyForVisit(visit, profile));
  }

  function getVisitNotes(visit) {
    return (rowsSource.visitNotes ?? []).filter((note) => visit?.id && note.visit_id === visit.id);
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

  async function logProjectActivity(projectId, activityType, message, metadata = {}) {
    if (!supabase || !profile || !projectId || !rowsSource.companyId) return;

    const { error } = await supabase.from("visit_activity").insert({
      company_id: rowsSource.companyId,
      project_id: projectId,
      visit_id: null,
      actor_id: profile.id,
      activity_type: activityType,
      message,
      metadata,
    });

    if (error) setNotice(error.message);
  }

  async function savePasswordSettings(event) {
    event.preventDefault();
    if (!supabase || !profile) return;
    const password = passwordForm.password.trim();
    const confirm = passwordForm.confirm.trim();
    if (password.length < 8) {
      setNotice("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setNotice("Passwords do not match.");
      return;
    }

    setLoading(true);
    setNotice("Updating password...");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordForm({ password: "", confirm: "" });
      setModalType(null);
      triggerSoftPulse();
      setNotice("Password updated.");
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "savePasswordSettings" });
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadPhotosWithProgress({ files, captions, fileType, label, project, searchTextForFile, visit }) {
    let completed = 0;
    const rows = [];

    for (const file of files) {
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
      rows.push(row);
      setUploadProgress({ current: completed, total: files.length, label });
      commitWorkspaceData((current) => ({ ...current, files: [row, ...(current.files ?? [])] }));
    }

    return rows;
  }

  function getSiteVisitFiles(item) {
    return (rowsSource.files ?? []).filter((file) => item?.id && file.site_visit_id === item.id);
  }

  function getChangeOrderFiles(item) {
    return (rowsSource.files ?? []).filter((file) => item?.id && file.change_order_id === item.id);
  }

  function getVisitNoteFiles(note) {
    return (rowsSource.files ?? []).filter((file) => note?.id && file.note_id === note.id);
  }

  async function uploadFieldReportPhotos({ captions = {}, changeOrderId, description, files = [], folders = [], label, project, proposedWork = "", siteVisitId }) {
    const plainQueue = (files ?? []).map((file) => ({
      caption: captions?.[fileInputKey(file)]?.trim() || "",
      file,
      folderDescription: "",
      folderName: "",
    }));
    const folderQueue = folders.flatMap((folder) =>
      (folder.files ?? []).map((file) => ({
        caption: folder.captions?.[fileInputKey(file)]?.trim() || "",
        file,
        folderDescription: folder.description?.trim() || "",
        folderName: folder.name?.trim() || "",
      })),
    );
    const queue = [...plainQueue, ...folderQueue];
    if (queue.length === 0) return [];

    const rows = [];
    let completed = 0;
    setUploadProgress({ current: 0, total: queue.length, label });
    for (const item of queue) {
      const row = await uploadVisitAttachment({
        changeOrderId,
        companyId: rowsSource.companyId,
        folderDescription: item.folderDescription,
        folderName: item.folderName,
        projectId: project.id,
        profileId: profile.id,
        siteVisitId,
        file: item.file,
        photoCaption: item.caption,
        searchText: `${label}. ${project.name}. ${primaryProjectAddress(project)}. ${description || ""}. ${proposedWork || ""}. ${item.folderName}. ${item.folderDescription}. ${item.caption}`,
      });
      rows.push(row);
      completed += 1;
      setUploadProgress({ current: completed, total: queue.length, label });
      commitWorkspaceData((current) => ({ ...current, files: [row, ...(current.files ?? [])] }));
    }
    return rows;
  }

  async function uploadVisitNotePhotos({ captions = {}, files = [], note, project, visit }) {
    if (!note?.id || !visit?.id || files.length === 0) return [];
    const rows = [];
    let completed = 0;
    setUploadProgress({ current: 0, total: files.length, label: "Ticket note photos" });
    for (const file of files) {
      const caption = captions?.[fileInputKey(file)]?.trim() || "";
      const row = await uploadVisitAttachment({
        companyId: rowsSource.companyId,
        projectId: project.id,
        visitId: visit.id,
        noteId: note.id,
        profileId: profile.id,
        file,
        fileType: "project_document",
        photoCaption: caption,
        searchText: `Ticket note photo. ${project.name}. ${visit.work_scope || ""}. ${note.note_text || ""}. ${caption}`,
      });
      rows.push(row);
      completed += 1;
      setUploadProgress({ current: completed, total: files.length, label: "Ticket note photos" });
      commitWorkspaceData((current) => ({ ...current, files: [row, ...(current.files ?? [])] }));
    }
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

  function openSiteVisitOverlay(item) {
    if (!item) return;
    setSelectedProjectId(item.project_id);
    setSelectedSiteVisitId(item.id);
    setSelectedDate(item.visit_date);
    showDetailOverlay("siteVisit");
  }

  function editSiteVisit(item) {
    if (!item || !canCreateSiteInspections) return;
    setSelectedProjectId(item.project_id);
    setSelectedSiteVisitId(item.id);
    setEditingSiteVisitId(item.id);
    setSiteVisitForm({
      ...emptySiteVisitForm,
      project_id: item.project_id,
      visit_date: item.visit_date || getWinnipegDateValue(),
      start_time: String(item.start_time || "07:00").slice(0, 5),
      end_time: String(item.end_time || "17:00").slice(0, 5),
      status: item.status || "planned",
      description: item.description || "",
      files: [],
      captions: {},
      folders: [],
    });
    setModalType("siteVisit");
  }

  function editChangeOrder(item) {
    if (!item || !canCreateChangeOrders) return;
    setSelectedProjectId(item.project_id);
    setSelectedChangeOrderId(item.id);
    setEditingChangeOrderId(item.id);
    setChangeOrderForm({
      ...emptyChangeOrderForm,
      project_id: item.project_id,
      order_date: item.order_date || getWinnipegDateValue(),
      order_time: String(item.order_time || getWinnipegTimeValue()).slice(0, 5),
      order_number: item.order_number || "",
      status: normalizeChangeOrderStatus(item.status),
      description: item.description || "",
      proposed_work: item.proposed_work || "",
      approved_by: item.approved_by || "",
      approval_signature: item.approval_signature || "",
      files: [],
      captions: {},
      folders: [],
    });
    setModalType("changeOrder");
  }

  function openChangeOrderOverlay(item) {
    if (!item) return;
    setSelectedProjectId(item.project_id);
    setSelectedChangeOrderId(item.id);
    setSelectedDate(item.order_date);
    showDetailOverlay("changeOrder");
  }

  function openPersonOverlay(person) {
    if (!person?.id) return;
    setSelectedPersonId(person.id);
    showDetailOverlay("person");
  }

  function openMyProfile() {
    if (!profile?.id) return;
    closeMenusThen(() => {
      setSelectedPersonId(profile.id);
      showDetailOverlay("person");
    });
  }

  function editMyProfile() {
    if (!profile?.id) return;
    const [first = "", ...rest] = String(profile.first_name || profile.full_name || "").split(" ").filter(Boolean);
    setProfileForm({
      first_name: profile.first_name || first,
      last_name: profile.last_name || rest.join(" "),
      phone: profile.phone || "",
      avatarFile: null,
      avatarEmoji: profile.avatar_emoji || "",
      removeAvatar: false,
    });
    setIsAccountMenuOpen(false);
    setModalType("profileEdit");
  }

  function openPasswordChange() {
    setPasswordForm({ password: "", confirm: "" });
    setModalType("passwordChange");
  }

  function openSettingsHub() {
    closeMenusThen(() => setModalType("settingsHub"));
  }

  function openHelpCenter() {
    closeMenusThen(() => setModalType("helpCenter"));
  }

  function openDeveloperMode() {
    if (!canUseDeveloperMode) {
      setNotice("Developer mode is available to Owner, PM, and Office Manager roles.");
      return;
    }
    setDeveloperForm({ ...normalizeFeatureFlags(featureFlags), botCount: "10" });
    closeMenusThen(() => {
      setModalType("developerMode");
    });
  }

  function startArrivalWorkflow(visit = currentVisit) {
    if (!visit?.id) {
      setNotice("Select today's visit first.");
      return;
    }
    const today = getWinnipegDateValue();
    if (visit.status === "planned" && !canStartPlannedVisit(visit, today)) {
      setNotice(isFutureDate(visit.visit_date, today) ? "Future tickets cannot be started yet." : "Past planned tickets can be corrected by PM, Owner, or Office Manager.");
      return;
    }
    if (visit.status === "on_site" && isFutureDate(visit.visit_date, today)) {
      setNotice("Future tickets cannot be worked yet.");
      return;
    }
    if (!["planned", "on_site"].includes(visit.status)) {
      setNotice("Only planned or active tickets can use Arrived workflow.");
      return;
    }

    const files = getVisitFiles(visit);
    const safetyFiles = files.filter((file) => file.file_type === "safety_form");
    const hasSafety = profileHasSafetyForVisit(visit, profile);
    const hasBefore = files.some((file) => file.file_type === "before_photo");

    setWorkflowVisitId(visit.id);
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);

    if (activeFeatureFlags.safetyForm && !hasSafety) {
      const assignedTeam = rowsSource.people.filter((person) => visit.people_ids?.includes(person.id));
      const team = safetyFiles.length > 0 && profile?.id ? assignedTeam.filter((person) => person.id === profile.id) : assignedTeam;
      setSafetyForm({
        responses: emptySafetyResponses(activeFeatureFlags.safetyTemplate),
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
    const today = getWinnipegDateValue();
    if (visit.status !== "on_site") {
      setNotice("Only Active tickets can be completed.");
      return;
    }
    if (isFutureDate(visit.visit_date, today)) {
      setNotice("Future tickets cannot be completed before the visit date.");
      return;
    }
    if (visitActionsBlockedBySafety(visit)) {
      setNotice("Complete your Safety Form before continuing.");
      startArrivalWorkflow(visit);
      return;
    }

    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);
    setWorkflowVisitId(visit.id);
    setCompletionForm({ notes: "", files: [], captions: {} });
    setModalType("completeVisit");
  }

  function openVisitNoteModal(visit = currentVisit, note = null) {
    if (!visit?.id || visit.status !== "on_site") {
      setNotice("Ticket notes are available only while the ticket is Active.");
      return;
    }
    if (isFutureDate(visit.visit_date, getWinnipegDateValue())) {
      setNotice("Future tickets cannot receive work notes before the visit date.");
      return;
    }
    if (visitActionsBlockedBySafety(visit)) {
      setNotice("Complete your Safety Form before adding notes.");
      startArrivalWorkflow(visit);
      return;
    }
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);
    setWorkflowVisitId(visit.id);
    setVisitNoteForm({
      ...emptyVisitNoteForm,
      id: note?.id || "",
      visit_id: visit.id,
      note_text: note?.note_text || "",
      files: [],
      captions: {},
    });
    setModalType("visitNote");
  }

  async function saveVisitNote(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
    const activeVisit = (rowsSource.visits ?? []).find((visit) => visit.id === visitNoteForm.visit_id) ?? workflowVisit ?? currentVisit;
    const activeProject = activeVisit ? rowsSource.projects.find((project) => project.id === activeVisit.project_id) ?? workflowProject ?? selectedProject : workflowProject ?? selectedProject;
    if (!supabase || !profile || !activeVisit || !activeProject) {
      setNotice("Select an active ticket before saving a note.");
      return;
    }
    if (activeVisit.status !== "on_site") {
      setNotice("Notes can be added only while the ticket is Active.");
      return;
    }
    const noteText = visitNoteForm.note_text.trim();
    if (!noteText && visitNoteForm.files.length === 0) {
      setNotice("Add a comment or at least one photo before saving.");
      return;
    }

    setActionPending("visitNote", true);
    setNotice(visitNoteForm.id ? "Saving ticket note..." : "Adding ticket note...");
    try {
      const payload = {
        company_id: rowsSource.companyId,
        project_id: activeProject.id,
        visit_id: activeVisit.id,
        author_id: profile.id,
        note_text: noteText || null,
      };
      const noteQuery = visitNoteForm.id
        ? supabase.from("visit_notes").update({ note_text: payload.note_text, updated_at: new Date().toISOString() }).eq("id", visitNoteForm.id).select().single()
        : supabase.from("visit_notes").insert(payload).select().single();
      const { data: savedNote, error } = await noteQuery;
      if (error) throw error;

      await uploadVisitNotePhotos({
        captions: visitNoteForm.captions,
        files: visitNoteForm.files,
        note: savedNote,
        project: activeProject,
        visit: activeVisit,
      });
      await logVisitActivity(activeVisit, visitNoteForm.id ? "ticket_note_updated" : "ticket_note_added", `${currentUserName} ${visitNoteForm.id ? "updated" : "added"} an active ticket note.`, { noteId: savedNote.id });
      commitWorkspaceData((current) => {
        const kept = (current.visitNotes ?? []).filter((note) => note.id !== savedNote.id);
        return { ...current, visitNotes: [savedNote, ...kept] };
      });
      setVisitNoteForm(emptyVisitNoteForm);
      setModalType(null);
      setUploadProgress(null);
      if (!visitNoteForm.id) {
        void createNotifications({
          managers: true,
          message: `${currentUserName} added a note to an active ticket at ${activeProject.name}.`,
          projectId: activeProject.id,
          title: "New active ticket note",
          type: "ticket_note_added",
          visitId: activeVisit.id,
        });
      }
      triggerSoftPulse();
      setNotice("Ticket note saved.");
      await Promise.all([loadVisitNotes(), loadFiles(), loadActivities()]);
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "saveVisitNote" });
      setNotice(error.message);
    } finally {
      setActionPending("visitNote", false);
      setUploadProgress(null);
    }
  }

  async function saveSafetyForm(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
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
    const isStartingTicket = !["on_site", "completed"].includes(activeVisit.status);
    const missingSignature = team.some((person) => !safetyForm.signatures[person.id]?.trim());
    const template = normalizeSafetyTemplate(activeFeatureFlags.safetyTemplate);
    const responses = { ...emptySafetyResponses(template), ...(safetyForm.responses ?? {}) };
    if (!safetyTemplateHasRequiredResponses(template, responses) || team.length === 0 || missingSignature) {
      setNotice("Confirm who is on site, complete required Safety Form fields, and collect every present team member signature before continuing.");
      return;
    }

    setActionPending("safetyForm", true);
    try {
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
      doc.text(doc.splitTextToSize(`Address: ${getVisitAddress(activeVisit, activeProject)}`, 492), 42, 170);
      doc.text(`Visit Date: ${formatDateLabel(activeVisit.visit_date)}`, 42, 196);
      doc.text(`Current Time: ${formatTimeLabel(getWinnipegTimeValue(signedAt))}`, 220, 196);
      doc.text(`Scheduled Time: ${formatTimeRange(activeVisit.start_time, activeVisit.end_time)}`, 398, 196);

      let y = 238;
      const ensurePdfSpace = (height) => {
        if (y + height < 626) return;
        doc.addPage();
        y = 44;
      };
      const drawCheckbox = (x, yPos, checked) => {
        doc.setDrawColor(checked ? 22 : 148, checked ? 163 : 163, checked ? 74 : 184);
        doc.setLineWidth(1);
        doc.roundedRect(x, yPos, 11, 11, 2, 2);
        if (!checked) return;
        doc.setFillColor(22, 163, 74);
        doc.roundedRect(x, yPos, 11, 11, 2, 2, "F");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.5);
        doc.line(x + 2.4, yPos + 6, x + 4.8, yPos + 8.3);
        doc.line(x + 4.8, yPos + 8.3, x + 9, yPos + 3);
      };
      const safetySummaryLines = [];
      template.objects.forEach((object) => {
        const response = responses[object.id];
        const valueText = safetyResponseText(object, response);
        ensurePdfSpace(object.type === "checkboxes" ? 58 + object.items.length * 30 : 86);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        const startY = y;
        const cardHeight = object.type === "checkboxes" ? 44 + object.items.reduce((height, item) => height + (response?.details?.[item.id] ? 42 : 24), 0) : 72;
        doc.roundedRect(42, startY, 528, Math.min(cardHeight, 330), 8, 8, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(17, 24, 39);
        doc.text(object.title, 58, y + 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        y += 42;
        if (object.type === "checkboxes") {
          const checked = new Set(response?.checked ?? []);
          object.items.forEach((item) => {
            ensurePdfSpace(42);
            drawCheckbox(58, y - 9, checked.has(item.id));
            doc.setTextColor(17, 24, 39);
            doc.text(doc.splitTextToSize(item.label, 430), 76, y);
            y += 22;
            if (response?.details?.[item.id]) {
              doc.setTextColor(71, 85, 105);
              doc.text(doc.splitTextToSize(`Details: ${response.details[item.id]}`, 440), 76, y);
              y += 20;
            }
          });
        } else {
          doc.setTextColor(51, 65, 85);
          doc.text(doc.splitTextToSize(valueText || "Not filled", 480), 58, y);
          y += 34;
        }
        y += 18;
        if (valueText) safetySummaryLines.push(`${object.title}: ${valueText}`);
      });

      ensurePdfSpace(190);
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
        ensurePdfSpace(116);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(42, y, 528, 98, 8, 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(person.full_name || person.email || "Team member", 58, y + 24);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Do not Sign untill you understand and agree with the PSI", 58, y + 42);
        doc.setFontSize(10);
        doc.text(`Signed: ${formatDateTimeLabel(signedAt)}`, 58, y + 60);
        doc.addImage(safetyForm.signatures[person.id], "PNG", 320, y + 20, 190, 48);
        y += 112;
      });
      doc.addImage(safetyLetterhead, "PNG", 332, 650, 238, 105);

      const blob = doc.output("blob");
      const searchableText = [
        activeProject.name,
        activeProject.job_number,
        getVisitAddress(activeVisit, activeProject),
        formatDateLabel(activeVisit.visit_date),
        formatDateTimeLabel(signedAt),
        safetySummaryLines.join(" "),
        `Signed team IDs: ${team.map((person) => person.id).join(", ")}`,
        `Signed team names: ${names.join(", ")}`,
        `Absent team: ${absentTeam.map((person) => person.full_name || person.email || "Team member").join(", ")}`,
        ...team.flatMap((person) => getSafetyIdentityTokens(person)),
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
        safetyTemplate: template,
        safetyResponses: responses,
        team: names,
        absentTeam: absentTeam.map((person) => person.full_name || person.email || "Team member"),
      });
      if (isStartingTicket && absentTeam.length > 0) {
        void createNotifications({
          includeActor: true,
          managers: true,
          message: `${activeProject.name} started with partial crew. Not arrived yet: ${absentTeam.map((person) => profileDisplayName(person, "Team member")).join(", ")}.`,
          projectId: activeProject.id,
          title: "Partial crew arrival",
          type: "partial_crew_arrival",
          visitId: activeVisit.id,
        });
      }

      const alreadyHasBeforePhotos = getVisitFiles(activeVisit).some((file) => file.file_type === "before_photo");
      if (!activeFeatureFlags.beforeAfterPhotos || alreadyHasBeforePhotos) {
        await updateVisitStatusById(activeVisit.id, "on_site");
        await logVisitActivity(activeVisit, "arrived", `${currentUserName} arrived and started work.`, {
          arrivedAt: new Date().toISOString(),
          skippedBeforePhotos: !activeFeatureFlags.beforeAfterPhotos,
          joinedAfterBeforePhotos: alreadyHasBeforePhotos,
        });
        setModalType(null);
        setWorkflowVisitId("");
        setSafetyForm({ responses: emptySafetyResponses(activeFeatureFlags.safetyTemplate), signatures: {}, presentIds: [] });
        triggerSoftPulse();
        setNotice(alreadyHasBeforePhotos ? "Safety form saved. Your ticket actions are unlocked." : "Safety form saved. Work started.");
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
      recordClientError(error, { ...errorContextRef.current, source: "saveSafetyForm" });
      setNotice(error.message);
    } finally {
      setActionPending("safetyForm", false);
    }
  }

  async function saveBeforePhotos(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
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

    setActionPending("beforePhotos", true);
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
      recordClientError(error, { ...errorContextRef.current, source: "saveBeforePhotos" });
      setNotice(error.message);
    } finally {
      setUploadProgress(null);
      setActionPending("beforePhotos", false);
    }
  }

  async function saveCompletion(event) {
    event.preventDefault();
    if (preventSaveDuringDictation(event)) return;
    const activeVisit = workflowVisit ?? currentVisit;
    const activeProject = workflowProject ?? selectedProject;
    if (!supabase || !profile || !activeVisit || !activeProject) {
      setNotice("Select a visit before completing work.");
      return;
    }
    const assignedPeople = rowsSource.people.filter((person) => activeVisit.people_ids?.includes(person.id));
    const onBehalfNames = assignedPeople.map((person) => profileDisplayName(person, "Team member")).join(", ") || "assigned crew";
    const officeOverride = canManage && isPastDate(activeVisit.visit_date, getWinnipegDateValue()) && !activeVisit.people_ids?.includes(profile.id);
    const requiresAfterPhotos = activeFeatureFlags.beforeAfterPhotos && !officeOverride;
    if (requiresAfterPhotos && completionForm.files.length === 0) {
      setNotice("Upload at least one after photo before completing work.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await queueCompletionOffline({
        completionNotes: completionForm.notes,
        files: completionForm.files,
        project: activeProject,
        visit: activeVisit,
      });
      setModalType(null);
      setWorkflowVisitId("");
      setCompletionForm({ notes: "", files: [], captions: {} });
      setNotice("Saved offline on this device. It will sync to Supabase when the connection is back.");
      return;
    }

    setActionPending("completion", true);
    try {
      const completedLate = isPastDate(activeVisit.visit_date, getWinnipegDateValue());
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
      await logVisitActivity(
        activeVisit,
        "completed",
        officeOverride
          ? `${currentUserName} closed this previous-day active ticket on behalf of ${onBehalfNames}.`
          : completedLate
            ? `${currentUserName} completed a previous-day active visit for ${formatDateLabel(activeVisit.visit_date)}.`
            : `${currentUserName} completed the visit.`,
        {
          completedAt: new Date().toISOString(),
          completedLate,
          officeOverride,
          onBehalfOf: assignedPeople.map((person) => ({ id: person.id, name: profileDisplayName(person, "Team member") })),
          ticketDate: activeVisit.visit_date,
          notes: completionForm.notes,
          skippedAfterPhotos: !activeFeatureFlags.beforeAfterPhotos,
        },
      );
      setModalType(null);
      setWorkflowVisitId("");
      setCompletionForm({ notes: "", files: [], captions: {} });
      triggerSoftPulse();
      setNotice(completedLate ? "Past Active ticket completed. Saved with current Winnipeg time." : "Thank you. Work is Done.");
      loadVisits();
      loadActivities();
      loadFiles();
    } catch (error) {
      recordClientError(error, { ...errorContextRef.current, source: "saveCompletion" });
      if (isProbablyOfflineError(error)) {
        try {
          await queueCompletionOffline({
            completionNotes: completionForm.notes,
            files: completionForm.files,
            project: activeProject,
            visit: activeVisit,
          });
          setModalType(null);
          setWorkflowVisitId("");
          setCompletionForm({ notes: "", files: [], captions: {} });
          setNotice("Connection dropped. Completion was saved offline and will retry automatically.");
          return;
        } catch (queueError) {
          recordClientError(queueError, { ...errorContextRef.current, source: "queueCompletionOffline" });
        }
      }
      setNotice(error.message);
    } finally {
      setUploadProgress(null);
      setActionPending("completion", false);
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
    void createNotifications({
      builderIds: [
        ...(assignment.people ?? []).map((person) => person.id),
        row.kind === "person" ? row.id : "",
        assignment.type === "person" ? assignment.resourceId : "",
      ].filter(Boolean),
      message: `${currentUserName} updated your ticket time to ${formatTimeRange(nextStartTime, nextEndTime)}.`,
      projectId: assignment.projectId,
      title: "Ticket schedule updated",
      type: "ticket_updated",
      visitId: assignment.visitId,
    });
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
      void createNotifications({
        builderIds: [personId],
        message: `${currentUserName} assigned you to ${visit.work_scope || "a ticket"} on ${formatDateLabel(visit.visit_date)}.`,
        projectId: visit.project_id,
        title: "Ticket assignment changed",
        type: "ticket_assigned",
        visitId,
      });
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
      void createNotifications({
        builderIds: eligibleIds,
        message: `${currentUserName} assigned your group to ${visit.work_scope || "a ticket"} on ${formatDateLabel(visit.visit_date)}.`,
        projectId: visit.project_id,
        title: "Ticket assignment changed",
        type: "ticket_assigned",
        visitId,
      });
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
      void createNotifications({
        builderIds: [personId],
        message: `${currentUserName} removed you from ${visit.work_scope || "a ticket"} on ${formatDateLabel(visit.visit_date)}.`,
        projectId: visit.project_id,
        title: "Ticket assignment changed",
        type: "ticket_assignment_removed",
        visitId,
      });
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
    if (!canManage && activeNav !== "changeOrders") {
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
    else if (activeNav === "siteVisits") {
      setEditingSiteVisitId(null);
      setSiteVisitForm({
        ...emptySiteVisitForm,
        project_id: selectedProject?.id ?? rowsSource.projects[0]?.id ?? "",
        visit_date: selectedDate,
        files: [],
        captions: {},
        folders: [],
      });
      setModalType("siteVisit");
    }
    else if (activeNav === "changeOrders") {
      setEditingChangeOrderId(null);
      setChangeOrderForm({
        ...emptyChangeOrderForm,
        project_id: selectedProject?.id ?? rowsSource.projects[0]?.id ?? "",
        order_date: getWinnipegDateValue(),
        order_time: getWinnipegTimeValue(),
        files: [],
        captions: {},
        folders: [],
      });
      setModalType("changeOrder");
    }
    else if (activeNav === "people") setModalType("people");
    else {
      if (!(await acquireEditLock({ mode: "create", resourceType: "visit" }))) return;
      const defaultProject = selectedProject ?? rowsSource.projects[0];
      setEditingVisitId(null);
      const nextVisitForm = {
        ...emptyVisitForm,
        visit_date: selectedDate,
        project_id: defaultProject?.id ?? "",
        address: primaryProjectAddress(defaultProject),
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

  async function openVisitModal(projectId = selectedProject?.id, defaults = {}) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can schedule visits.");
      return;
    }
    if (!(await acquireEditLock({ mode: "create", resourceType: "visit" }))) return;

    setEditingVisitId(null);
    const project = rowsSource.projects.find((item) => item.id === projectId);
    const nextVisitForm = {
      ...emptyVisitForm,
      visit_date: selectedDate,
      project_id: projectId ?? "",
      address: primaryProjectAddress(project),
      ...defaults,
      people_ids: defaults.people_ids ?? [],
      equipment_ids: defaults.equipment_ids ?? [],
      work_scopes: defaults.work_scopes ?? [defaults.work_scope ?? ""],
    };
    setVisitForm(nextVisitForm);
    editorInitialSnapshotRef.current.visit = serializeVisitEditorForm(nextVisitForm);
    setModalType("visit");
  }

  function getDropTimeRange(clientX, trackElement) {
    if (!trackElement) return { start_time: "07:00", end_time: "17:00" };
    const rect = trackElement.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const rawStart = scheduleStartHour + percent * (scheduleEndHour - scheduleStartHour);
    const startHour = Math.max(scheduleStartHour, Math.min(scheduleEndHour - 1, Math.round(rawStart * 2) / 2));
    const endHour = Math.min(scheduleEndHour, Math.max(startHour + 1, startHour + 10));
    return { start_time: toTimeValue(startHour), end_time: toTimeValue(endHour) };
  }

  async function openVisitModalFromScheduleDrop({ clientX, groupLabel, personId, personIds, projectId, trackElement }) {
    const requestedPersonIds = [...new Set(personIds?.length ? personIds : personId ? [personId] : [])];
    if (requestedPersonIds.length === 0) return;
    const selectedPeople = requestedPersonIds
      .map((id) => rowsSource.people.find((item) => item.id === id))
      .filter(Boolean);
    const project = rowsSource.projects.find((item) => item.id === projectId);
    if (selectedPeople.length === 0) return;
    const availablePeople = selectedPeople.filter((person) => person.availability_status !== "not_available");
    const skippedCount = selectedPeople.length - availablePeople.length;
    if (availablePeople.length === 0) {
      setNotice(groupLabel ? `${groupLabel} has no available people for this ticket.` : `${profileDisplayName(selectedPeople[0])} is marked Not Available.`);
      return;
    }
    const timeDefaults = getDropTimeRange(clientX, trackElement);
    await openVisitModal(project?.id, {
      ...timeDefaults,
      visit_date: selectedDate,
      project_id: project?.id ?? "",
      address: primaryProjectAddress(project),
      people_ids: availablePeople.map((person) => person.id),
    });
    setNotice(
      availablePeople.length > 1
        ? `${availablePeople.length} people from ${groupLabel || "group"} selected for the new ticket${skippedCount ? `, ${skippedCount} skipped` : ""}.`
        : `${profileDisplayName(availablePeople[0])} selected for the new ticket.`,
    );
  }

  function openChangeOrderForVisit(visit = currentVisit) {
    if (!visit?.id) {
      setNotice("Select an active ticket first.");
      return;
    }
    if (visit.status !== "on_site") {
      setNotice("Change Order from Overview is available only for an Active ticket.");
      return;
    }
    if (visitActionsBlockedBySafety(visit)) {
      setNotice("Complete your Safety Form before creating a Change Order.");
      startArrivalWorkflow(visit);
      return;
    }
    if (!activeFeatureFlags.changeOrders) {
      setNotice("Change Order is disabled in Developer mode.");
      return;
    }
    const project = rowsSource.projects.find((item) => item.id === visit.project_id);
    if (!project) {
      setNotice("Project not found for this ticket.");
      return;
    }
    setSelectedProjectId(project.id);
    setSelectedVisitId(visit.id);
    setEditingChangeOrderId(null);
    setChangeOrderForm({
      ...emptyChangeOrderForm,
      project_id: project.id,
      order_date: getWinnipegDateValue(),
      order_time: getWinnipegTimeValue(),
      description: visit.work_scope ? `Change Order for: ${visit.work_scope}` : "",
      files: [],
      captions: {},
      folders: [],
    });
    setModalType("changeOrder");
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
    if (assignment.recordType === "siteVisit") {
      const item = (rowsSource.siteVisits ?? []).find((row) => row.id === assignment.recordId);
      if (item) openSiteVisitOverlay(item);
      return;
    }
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
    const visitProject = rowsSource.projects.find((project) => project.id === visit.project_id) ?? selectedProject;
    const nextVisitForm = {
      project_id: visit.project_id ?? selectedProject?.id ?? "",
      address: getVisitAddress(visit, visitProject),
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
          .filter((file) => {
            const fileIsPhoto = file.file_kind === "photo" || file.mime_type?.startsWith("image/");
            if (!fileIsPhoto || file.project_id !== opened.project_id) return false;
            if (opened.visit_id) return file.visit_id === opened.visit_id;
            if (opened.site_visit_id) return file.site_visit_id === opened.site_visit_id;
            if (opened.change_order_id) return file.change_order_id === opened.change_order_id;
            return !file.visit_id && !file.site_visit_id && !file.change_order_id;
          })
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

  async function saveSelectedPhotoCaption(attachment, caption) {
    if (!attachment?.id || !supabase) return;
    const nextCaption = caption.trim();
    setLoading(true);
    try {
      const { data: updatedFile, error } = await supabase
        .from("visit_files")
        .update({ photo_caption: nextCaption || null })
        .eq("id", attachment.id)
        .select()
        .single();
      if (error) throw error;

      const updated = { ...attachment, ...updatedFile };
      setSelectedAttachment(updated);
      setViewerItems((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updatedFile } : item)));
      commitWorkspaceData((current) => ({
        ...current,
        files: (current.files ?? []).map((file) => (file.id === updated.id ? { ...file, ...updatedFile } : file)),
      }));
      triggerSoftPulse();
      setNotice(nextCaption ? "Photo note saved." : "Photo note removed.");
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

  async function downloadAttachmentArchive(files = [], label = "Attachments") {
    const archiveFiles = files.filter((file) => !file.localPreview);
    if (archiveFiles.length === 0) {
      setNotice("No files in this block to download.");
      return;
    }

    setLoading(true);
    setNotice(`Preparing ${label} archive...`);
    try {
      const { zipSync } = await import("fflate");
      const zipEntries = {};
      const usedNames = new Map();

      for (const [index, file] of archiveFiles.entries()) {
        const urls = file.viewUrl ? file : await createAttachmentUrls(file);
        if (!urls.viewUrl) throw new Error(`Download link is not available for ${file.file_name || "file"}.`);
        setNotice(`Adding ${index + 1} of ${archiveFiles.length} to archive...`);
        const response = await fetch(urls.viewUrl);
        if (!response.ok) throw new Error(`Could not download ${file.file_name || "file"}.`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const baseName = cleanDownloadFileName(file.file_name || `attachment-${index + 1}`);
        const seenCount = usedNames.get(baseName) ?? 0;
        usedNames.set(baseName, seenCount + 1);
        const archiveName = seenCount ? `${seenCount + 1}-${baseName}` : baseName;
        zipEntries[archiveName] = bytes;
      }

      const zipBlob = new Blob([zipSync(zipEntries)], { type: "application/zip" });
      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = zipUrl;
      link.download = `${cleanDownloadFileName(label)}.zip`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(zipUrl), 2500);
      setNotice(`${label} archive downloaded.`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
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

  async function exportSiteVisitPdf(item = selectedSiteVisit) {
    if (!item) return;
    const project = rowsSource.projects.find((projectItem) => projectItem.id === item.project_id) ?? selectedProject;
    setLoading(true);
    setNotice("Preparing Site Inspection PDF...");
    try {
      const { exportFieldReportPdf } = await import("./lib/exporters.js");
      const files = await hydrateExportFiles(getSiteVisitFiles(item));
      await exportFieldReportPdf({
        type: "siteVisit",
        record: item,
        project,
        files,
        creatorName: getProfileName(item.created_by, currentUserName),
      });
      setNotice("Site Inspection PDF exported.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function exportChangeOrderPdf(item = selectedChangeOrder) {
    if (!item) return;
    const project = rowsSource.projects.find((projectItem) => projectItem.id === item.project_id) ?? selectedProject;
    setLoading(true);
    setNotice("Preparing Change Order PDF...");
    try {
      const { exportFieldReportPdf } = await import("./lib/exporters.js");
      const files = await hydrateExportFiles(getChangeOrderFiles(item));
      await exportFieldReportPdf({
        type: "changeOrder",
        record: item,
        project,
        files,
        creatorName: getProfileName(item.created_by, currentUserName),
      });
      setNotice("Change Order PDF exported.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function emailChangeOrderReport(item = selectedChangeOrder) {
    if (!item) return;
    const project = rowsSource.projects.find((projectItem) => projectItem.id === item.project_id) ?? selectedProject;
    const clientEmail = project?.contact_email?.trim();
    if (!clientEmail) {
      setNotice("Add client email to the project before emailing a Change Order.");
      return;
    }

    const subject = `Change Order ${item.order_number || ""}`.trim();
    const body = `Hi,\n\nPlease see attached change order report approved by ${item.approved_by || "the approver"}.`;
    setLoading(true);
    setNotice("Preparing Change Order email...");
    try {
      const { exportFieldReportPdf } = await import("./lib/exporters.js");
      const files = await hydrateExportFiles(getChangeOrderFiles(item));
      await exportFieldReportPdf({
        type: "changeOrder",
        record: item,
        project,
        files,
        creatorName: getProfileName(item.created_by, currentUserName),
        download: true,
      });
      window.location.href = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setNotice("PDF downloaded. Email draft opened.");
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
    } else if (result.type === "siteVisit") {
      const item = (rowsSource.siteVisits ?? []).find((row) => row.id === result.id.replace("siteVisit-", ""));
      if (item) openSiteVisitOverlay(item);
      setActiveNav("siteVisits");
    } else if (result.type === "changeOrder") {
      const item = (rowsSource.changeOrders ?? []).find((row) => row.id === result.id.replace("changeOrder-", ""));
      if (item) openChangeOrderOverlay(item);
      setActiveNav("changeOrders");
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

  function updateVisitProject(projectId) {
    const project = rowsSource.projects.find((item) => item.id === projectId);
    setVisitForm((current) => ({ ...current, project_id: projectId, address: primaryProjectAddress(project) }));
  }

  function updateProjectAddress(index, patch) {
    setProjectForm((current) => {
      const addresses = normalizeProjectAddresses(current);
      const nextAddresses = addresses.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
      const primaryAddress = nextAddresses[0]?.address ?? "";
      return { ...current, address: primaryAddress, addresses: nextAddresses };
    });
  }

  function addProjectAddress() {
    setProjectForm((current) => {
      const addresses = normalizeProjectAddresses(current);
      return { ...current, addresses: [...addresses, makeProjectAddress(addresses.length + 1)] };
    });
  }

  function removeProjectAddress(index) {
    setProjectForm((current) => {
      const addresses = normalizeProjectAddresses(current).filter((_, itemIndex) => itemIndex !== index);
      const nextAddresses = addresses.length ? addresses : [makeProjectAddress(1)];
      return { ...current, address: nextAddresses[0]?.address ?? "", addresses: nextAddresses };
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
    if (result.type === "siteVisit") return <ClipboardCheck size={18} />;
    if (result.type === "changeOrder") return <FileBarChart2 size={18} />;
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

    if (isPasswordRecovery) {
      return (
        <PasswordRecoveryScreen
          form={recoveryForm}
          loading={loading}
          notice={notice}
          onChange={setRecoveryForm}
          onSubmit={saveRecoveredPassword}
        />
      );
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
        authAvatarEmoji={authAvatarEmoji}
        forgotEmail={forgotEmail}
        forgotStep={forgotStep}
        loading={loading}
        modalType={modalType}
        notice={notice}
        onAvatarChange={(file) => {
          setAuthAvatarFile(file);
          if (file) setAuthAvatarEmoji("");
        }}
        onAvatarEmojiChange={(emoji) => {
          setAuthAvatarEmoji(emoji);
          if (emoji) setAuthAvatarFile(null);
        }}
        onEmailChange={setAuthEmail}
        onFirstNameChange={setAuthFirstName}
        onLastNameChange={setAuthLastName}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onPhoneChange={setAuthPhone}
        onForgotPassword={() => {
          setForgotEmail(authEmail.trim().toLowerCase());
          setForgotStep("form");
          setModalType("forgotPassword");
        }}
        onForgotEmailChange={setForgotEmail}
        onForgotClose={() => setModalType(null)}
        onForgotSubmit={sendPasswordReset}
        onForgotBackToSignIn={() => {
          setModalType(null);
          setAuthMode("signin");
        }}
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
          <ProjectsView canManage={canManage} getProfileName={getProfileName} projects={rowsSource.projects} onDelete={deleteProject} onEdit={editProject} onSelect={selectProject} onStatusChange={changeProjectStatus} />
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
    if (activeNav === "siteVisits") {
      if (!activeFeatureFlags.siteInspections) {
        return <InfoView icon={ClipboardCheck} title="Site Inspection hidden" text="Site Inspection is disabled in Developer mode. Existing records stay saved in Supabase." />;
      }
      if (!canCreateSiteInspections) {
        return <InfoView icon={ClipboardCheck} title="Site Inspection access locked" text="Site Inspections are available to every active non-Builder role." />;
      }
      return (
        <>
          <SectionToolbar label="Site Inspection" onAdd={openAddModal} />
          <FieldReportsView
            emptyText="No Site Inspections saved yet."
            getProfileName={getProfileName}
            kind="siteVisit"
            onDelete={canDeleteTickets ? deleteSiteVisit : null}
            onExport={exportSiteVisitPdf}
            onOpen={openSiteVisitOverlay}
            onStatus={updateSiteVisitStatus}
            projects={rowsSource.projects}
            records={rowsSource.siteVisits ?? []}
          />
        </>
      );
    }
    if (activeNav === "changeOrders") {
      if (!activeFeatureFlags.changeOrders) {
        return <InfoView icon={FileBarChart2} title="Change Order hidden" text="Change Order is disabled in Developer mode. Existing records stay saved in Supabase." />;
      }
      if (!canCreateChangeOrders) {
        return <InfoView icon={FileBarChart2} title="Change Order access locked" text="Change Orders are available after your account is approved." />;
      }
      return (
        <>
          <SectionToolbar label="Change Order" onAdd={openAddModal} />
          <FieldReportsView
            emptyText="No Change Orders saved yet."
            getProfileName={getProfileName}
            kind="changeOrder"
            onDelete={canDeleteTickets ? deleteChangeOrder : null}
            onEmail={emailChangeOrderReport}
            onExport={exportChangeOrderPdf}
            onOpen={openChangeOrderOverlay}
            onStatus={updateChangeOrderStatus}
            projects={rowsSource.projects}
            records={rowsSource.changeOrders ?? []}
          />
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
    if (activeNav === "overview") {
      return <OverviewView data={rowsSource} getProfileName={getProfileName} getVisitFiles={getVisitFiles} onArrive={startArrivalWorkflow} onComplete={startCompletionWorkflow} onCreateChangeOrder={openChangeOrderForVisit} onDateChange={setOverviewDate} onOpenNote={openVisitNoteModal} onOpenVisit={openVisitOverlay} profile={profile} projects={rowsSource.projects} selectedDate={overviewDate} today={todayValue} visits={overviewVisits} />;
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
        onCreateVisitFromDrop={openVisitModalFromScheduleDrop}
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

  if (isPasswordRecovery || !session || !profile?.is_active) {
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
        </nav>

        <div className="sidebarUserWrap" ref={accountMenuRef}>
          {(isAccountMenuOpen || isAccountMenuClosing) && (
            <div className={isAccountMenuClosing ? "accountMenu closing" : "accountMenu"}>
              <button type="button" onClick={openMyProfile}>
                <UserRound size={18} />
                <span>My profile</span>
              </button>
              <button type="button" onClick={openSettingsHub}>
                <Settings size={18} />
                <span>Settings</span>
              </button>
              <button type="button" onClick={openHelpCenter}>
                <CircleHelp size={18} />
                <span>Help</span>
              </button>
              <button type="button" onClick={() => closeMenusThen(signOut)}>
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            </div>
          )}
          <button
            className={isAccountMenuOpen ? "sidebarUser active" : "sidebarUser"}
            type="button"
            onClick={() => {
              if (isAccountMenuOpen) closeAccountMenuAnimated();
              else setIsAccountMenuOpen(true);
            }}
          >
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
          <NotificationButton count={unreadNotifications.length} mobile onClick={openNotifications} />
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

            <NotificationButton count={unreadNotifications.length} onClick={openNotifications} />

            <ServerStatusIndicator online={serverConnected && isSupabaseConfigured} queueCount={offlineQueueCount} />
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
              <button className="imageMenu" type="button" title="More" onClick={() => setNotice(primaryProjectAddress(selectedProject))}>
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
                <span>{primaryProjectAddress(selectedProject) || "No address set"}</span>
                <a href={getGoogleMapsUrl(primaryProjectAddress(selectedProject))} target="_blank" rel="noreferrer">
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
              <button className="arrivedButton" type="button" disabled={!currentVisit?.id} onClick={() => updateVisitStatus("on_site")}>
                <ClipboardCheck size={18} />
                Arrived
              </button>
              <button className="completeWorkButton" type="button" disabled={!currentVisit?.id} onClick={() => updateVisitStatus("completed")}>
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
                dictation={dictation}
                dictationBusy={dictationBusy}
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
                {searchQuery.trim().length < 1 ? (
                  <div className="searchEmptyState">Start typing to search across projects, visits, PDFs, and Excel files.</div>
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
            dictation={dictation}
            dictationBusy={dictationBusy}
            featureFlags={activeFeatureFlags}
            files={projectAttachments}
            getProfileName={getProfileName}
            onAddVisit={() => openVisitModal(selectedProject.id)}
            onClose={closeDetailOverlay}
            onEditProject={() => editProject(selectedProject)}
            onEditVisit={editVisit}
            onDownloadArchive={downloadAttachmentArchive}
            onEmailChangeOrder={emailChangeOrderReport}
            onExportPdf={() => exportCurrentProjectPdf(selectedProject)}
            onExportTicketsExcel={() => exportProjectTicketsToExcel(selectedProject)}
            onOpenAttachment={openAttachment}
            onOpenChangeOrder={openChangeOrderOverlay}
            onOpenSiteVisit={openSiteVisitOverlay}
            onOpenVisit={openVisitOverlay}
            onRemoveChangeOrder={deleteChangeOrder}
            onRemoveSiteVisit={deleteSiteVisit}
            onRemoveVisit={deleteVisit}
            onRemoveActivity={deleteActivityItem}
            onUpdateChangeOrderStatus={updateChangeOrderStatus}
            onUpdateSiteVisitStatus={updateSiteVisitStatus}
            onExportChangeOrder={exportChangeOrderPdf}
            onExportSiteVisit={exportSiteVisitPdf}
            onUploaded={(message) => {
              setNotice(message);
              loadFiles();
            }}
            people={rowsSource.people}
            profileId={profile?.id}
            project={selectedProject}
            activities={selectedProjectActivities}
            changeOrders={selectedProjectChangeOrders}
            siteVisits={selectedProjectSiteVisits}
            visits={selectedProjectVisits}
          />
        )}

        {activeFeatureFlags.siteInspections && detailOverlay === "siteVisit" && selectedProject && selectedSiteVisit && (
          <FieldReportDetailOverlay
            canDelete={canDeleteTickets}
            canManage={canCreateSiteInspections}
            companyId={rowsSource.companyId}
            dictation={dictation}
            dictationBusy={dictationBusy}
            files={selectedSiteVisitFiles}
            getProfileName={getProfileName}
            kind="siteVisit"
            onClose={closeDetailOverlay}
            onDelete={deleteSiteVisit}
            onEdit={editSiteVisit}
            onExport={exportSiteVisitPdf}
            onOpenAttachment={openAttachment}
            onStatus={updateSiteVisitStatus}
            onUploaded={(message) => {
              setNotice(message);
              loadFiles();
              logProjectActivity(selectedProject.id, "site_inspection_file_uploaded", `${currentUserName} added files to Site Inspection.`, { siteVisitId: selectedSiteVisit.id });
              loadActivities();
            }}
            profileId={profile?.id}
            project={selectedProject}
            record={selectedSiteVisit}
            profiles={rowsSource.people}
          />
        )}

        {activeFeatureFlags.changeOrders && detailOverlay === "changeOrder" && selectedProject && selectedChangeOrder && (
          <FieldReportDetailOverlay
            canDelete={canDeleteTickets}
            canManage={canCreateChangeOrders}
            companyId={rowsSource.companyId}
            dictation={dictation}
            dictationBusy={dictationBusy}
            files={selectedChangeOrderFiles}
            getProfileName={getProfileName}
            kind="changeOrder"
            onClose={closeDetailOverlay}
            onDelete={deleteChangeOrder}
            onEdit={editChangeOrder}
            onEmail={emailChangeOrderReport}
            onExport={exportChangeOrderPdf}
            onOpenAttachment={openAttachment}
            onStatus={updateChangeOrderStatus}
            onUploaded={(message) => {
              setNotice(message);
              loadFiles();
              logProjectActivity(selectedProject.id, "change_order_file_uploaded", `${currentUserName} added files to ${selectedChangeOrder.order_number || "Change Order"}.`, { changeOrderId: selectedChangeOrder.id });
              loadActivities();
            }}
            profileId={profile?.id}
            project={selectedProject}
            record={selectedChangeOrder}
            profiles={rowsSource.people}
          />
        )}

        {detailOverlay === "visit" && selectedProject && currentVisit && (
          <VisitDetailOverlay
            canDeleteTickets={canDeleteTickets}
            companyId={rowsSource.companyId}
            dictation={dictation}
            dictationBusy={dictationBusy}
            equipment={currentVisitEquipment}
            featureFlags={activeFeatureFlags}
            files={currentVisitFiles}
            getProfileName={getProfileName}
            onArrive={() => startArrivalWorkflow(currentVisit)}
            onClose={closeDetailOverlay}
            onComplete={() => startCompletionWorkflow(currentVisit)}
            onDownloadArchive={downloadAttachmentArchive}
            onEdit={() => editVisit(currentVisit)}
            onExportPdf={() => exportCurrentVisitPdf(currentVisit)}
            onOpenAttachment={openAttachment}
            onOpenNote={openVisitNoteModal}
            onUploaded={(message) => {
              setNotice(message);
              loadFiles();
            }}
            onRemove={deleteVisit}
            people={currentVisitPeople}
            profileId={profile?.id}
            profiles={rowsSource.people}
            project={selectedProject}
            notes={currentVisitNotes}
            safetyLocked={visitActionsBlockedBySafety(currentVisit)}
            today={todayValue}
            visit={currentVisit}
          />
        )}

        {detailOverlay === "person" && selectedPerson && (
          <PersonDetailOverlay
            avatarUrl={avatarUrls[selectedPerson.id]}
            canEdit={canManage || selectedPerson.id === profile?.id}
            isSelf={selectedPerson.id === profile?.id}
            onChangePassword={openPasswordChange}
            onEdit={() => (selectedPerson.id === profile?.id ? editMyProfile() : editPerson(selectedPerson))}
            onClose={closeDetailOverlay}
            person={selectedPerson}
          />
        )}

        {modalType === "notifications" && (
          <AppModal title="Notifications" onClose={() => setModalType(null)}>
            <NotificationsPanel
              notifications={data.notifications ?? []}
              onOpen={(item) => {
                setModalType(null);
                if (item.visit_id) {
                  const visit = rowsSource.visits.find((visitItem) => visitItem.id === item.visit_id);
                  if (visit) openVisitOverlay(visit);
                } else if (item.change_order_id) {
                  const changeOrder = (rowsSource.changeOrders ?? []).find((row) => row.id === item.change_order_id);
                  if (changeOrder) openChangeOrderOverlay(changeOrder);
                } else if (item.project_id) {
                  const project = rowsSource.projects.find((projectItem) => projectItem.id === item.project_id);
                  if (project) openProjectOverlay(project, "project");
                }
              }}
            />
          </AppModal>
        )}

        {modalType === "helpCenter" && (
          <AppModal title="BuildCore help" onClose={() => setModalType(null)} wide>
            <HelpCenter role={profile?.role} />
          </AppModal>
        )}

        {modalType === "settingsHub" && (
          <AppModal title="Settings" onClose={() => setModalType(null)}>
            <SettingsHub
              canManage={canManage}
              canUseDeveloperMode={canUseDeveloperMode}
              featureFlags={activeFeatureFlags}
              isConfigured={isSupabaseConfigured}
              profile={profile}
              onDeveloperMode={() => {
                setModalType(null);
                setDeveloperForm({ ...normalizeFeatureFlags(featureFlags), botCount: "10" });
                window.setTimeout(() => setModalType("developerMode"), 160);
              }}
              onNavigate={(navId) => {
                setModalType(null);
                clearDetailOverlay();
                setActiveNav(navId);
              }}
            />
          </AppModal>
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
                <button className="addButton" type="submit" disabled={companySaving || dictationBusy}>
                  <Save size={18} />
                  {companySaving ? "Saving..." : "Save company"}
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "project" && (
          <AppModal title={editingProjectId ? "Edit project" : "Add project"} onClose={closeEditorModal} wide>
            <form className="stackForm twoColumns" onSubmit={saveProject}>
              <FormField label="Job number">
                <div className="jobNumberInputGroup">
                  <input required value={projectForm.job_number} onChange={(event) => setProjectForm({ ...projectForm, job_number: event.target.value })} />
                  <button
                    className="outlineButton"
                    type="button"
                    onClick={() => {
                      const nextJobNumber = nextSequentialJobNumber(rowsSource.projects);
                      setProjectForm({ ...projectForm, job_number: nextJobNumber });
                      setNotice(`Project number ${nextJobNumber} generated.`);
                    }}
                  >
                    <Plus size={16} />
                    Generate
                  </button>
                </div>
              </FormField>
              <FormField label="Project name">
                <input required value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} />
              </FormField>
              <ProjectAddressEditor addresses={normalizeProjectAddresses(projectForm)} onAdd={addProjectAddress} onRemove={removeProjectAddress} onUpdate={updateProjectAddress} />
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
                <VoiceTextArea dictation={dictation} value={projectForm.description} onChange={(value) => setProjectForm({ ...projectForm, description: value })} />
              </FormField>
              <div className="formActions wide">
                <button className="addButton" type="submit" disabled={projectSaving || dictationBusy}>
                  <Save size={18} />
                  {projectSaving ? "Saving..." : editingProjectId ? "Save changes" : "Save project"}
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
                <VoiceTextArea dictation={dictation} value={equipmentForm.notes} onChange={(value) => setEquipmentForm({ ...equipmentForm, notes: value })} />
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
          <AppModal title={editingVisitId ? "Edit visit" : "Schedule visit"} onClose={closeEditorModal} wide>
            <form className="stackForm twoColumns" onSubmit={saveVisit}>
              <FormField label="Project">
                <ProjectSearchSelect projects={rowsSource.projects} value={visitForm.project_id} onChange={updateVisitProject} />
              </FormField>
              {visitForm.project_id && (
                <FormField label="Ticket address">
                  <select required value={visitForm.address} onChange={(event) => setVisitForm({ ...visitForm, address: event.target.value })}>
                    <option value="">Select address</option>
                    {visitProjectAddressOptions.map((item) => (
                      <option value={item.address} key={`${item.label}-${item.address}`}>
                        {item.label ? `${item.label}: ${item.address}` : item.address}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
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
                    <VoiceTextArea dictation={dictation} required value={visitWorkScopes[index] ?? ""} placeholder={`Describe work for ${formatShortDate(date)}`} onChange={(value) => updateVisitWorkScope(index, value)} />
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
              <GroupedPickerList groups={groupedVisitPickerPeople} selected={visitForm.people_ids} onToggle={(id) => toggleVisitArray("people_ids", id)} title="People by Trade" />
              <PickerList title="Equipment" items={visitPickerEquipment} selected={visitForm.equipment_ids} labelKey="name" onToggle={(id) => toggleVisitArray("equipment_ids", id)} />
              <div className="formActions wide">
                <button className="addButton" type="submit" disabled={visitSaving || dictationBusy || !visitForm.project_id}>
                  <Save size={18} />
                  {visitSaving ? "Saving..." : editingVisitId ? "Save changes" : "Save visit"}
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {activeFeatureFlags.siteInspections && modalType === "siteVisit" && (
          <AppModal title={editingSiteVisitId ? "Edit Site Inspection" : "Create Site Inspection"} onClose={() => closeModalWithConfirmation(fieldReportFormHasDraft(siteVisitForm))} wide>
            <SiteVisitForm dictation={dictation} dictationBusy={dictationBusy} form={siteVisitForm} loading={siteVisitSaving} onChange={setSiteVisitForm} onSubmit={saveSiteVisit} projects={rowsSource.projects} />
          </AppModal>
        )}

        {activeFeatureFlags.changeOrders && modalType === "changeOrder" && (
          <AppModal title={editingChangeOrderId ? "Edit Change Order" : "Create Change Order"} onClose={() => closeModalWithConfirmation(fieldReportFormHasDraft(changeOrderForm))} wide>
            <ChangeOrderForm changeOrders={rowsSource.changeOrders ?? []} dictation={dictation} dictationBusy={dictationBusy} form={changeOrderForm} loading={changeOrderSaving} onChange={setChangeOrderForm} onSubmit={saveChangeOrder} projects={rowsSource.projects} />
          </AppModal>
        )}

        {modalType === "safety" && workflowVisit && workflowProject && (
          <AppModal confirmOnClose={safetyFormHasDraft} title="Digital Safety Form" onClose={() => closeModalWithConfirmation(safetyFormHasDraft)} wide>
            <SafetyFormModal
              dictation={dictation}
              dictationBusy={dictationBusy}
              form={safetyForm}
              loading={safetyFormSaving}
              onChange={setSafetyForm}
              onSubmit={saveSafetyForm}
              project={workflowProject}
              template={activeFeatureFlags.safetyTemplate}
              team={workflowPeople}
              visit={workflowVisit}
            />
          </AppModal>
        )}

        {modalType === "beforePhotos" && workflowVisit && workflowProject && (
          <AppModal confirmOnClose={beforePhotosHaveDraft} title="Before Work Photos" onClose={() => closeModalWithConfirmation(beforePhotosHaveDraft)}>
            <PhotoStepModal
              captions={photoStep.captions}
              dictation={dictation}
              dictationBusy={dictationBusy}
              files={photoStep.files}
              label="Upload at least one photo before work starts."
              loading={beforePhotosSaving}
              onCaption={(key, value) => setPhotoStep((current) => ({ ...current, captions: { ...current.captions, [key]: value } }))}
              onFiles={(files) => setPhotoStep({ kind: "before", visitId: workflowVisit.id, files, captions: {} })}
              onSubmit={saveBeforePhotos}
            />
          </AppModal>
        )}

        {modalType === "completeVisit" && workflowVisit && workflowProject && (
          <AppModal confirmOnClose={completionHasDraft} title="Complete Work" onClose={() => closeModalWithConfirmation(completionHasDraft)}>
            <CompleteVisitModal
              dictation={dictation}
              dictationBusy={dictationBusy}
              form={completionForm}
              loading={completionSaving}
              onChange={setCompletionForm}
              onSubmit={saveCompletion}
              requirePhotos={activeFeatureFlags.beforeAfterPhotos && !(canManage && isPastDate(workflowVisit.visit_date, todayValue) && !workflowVisit.people_ids?.includes(profile?.id))}
            />
          </AppModal>
        )}

        {modalType === "visitNote" && workflowVisit && workflowProject && (
          <AppModal title={visitNoteForm.id ? "Edit Ticket Note" : "Add Ticket Note"} onClose={() => closeModalWithConfirmation(Boolean(visitNoteForm.note_text.trim()) || visitNoteForm.files.length > 0)}>
            <VisitNoteModal dictation={dictation} dictationBusy={dictationBusy} form={visitNoteForm} loading={visitNoteSaving} onChange={setVisitNoteForm} onSubmit={saveVisitNote} />
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
            className="attachmentModal"
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
                  dictation={dictation}
                  dictationBusy={dictationBusy}
                  items={viewerItems}
                  loading={loading}
                  onAnnotate={() => setIsAnnotatingPhoto(true)}
                  onCancelAnnotate={() => setIsAnnotatingPhoto(false)}
                  onDelete={removeSelectedAttachment}
                  onDownload={() => downloadAttachment(selectedAttachment)}
                  onSaveCaption={saveSelectedPhotoCaption}
                  onSaveAnnotation={annotateSelectedAttachment}
                  onSelect={setSelectedAttachment}
                  onZoom={setPhotoZoom}
                  profiles={rowsSource.people}
                  zoom={photoZoom}
                />
              ) : selectedAttachment.file_kind === "pdf" || selectedAttachment.mime_type === "application/pdf" ? (
                <DocumentFileViewer attachment={selectedAttachment} canDelete={!selectedAttachment.localPreview && (canManage || selectedAttachment.uploaded_by === profile?.id)} loading={loading} onDelete={removeSelectedAttachment} onDownload={() => downloadAttachment(selectedAttachment)}>
                  <PdfCanvasViewer fileName={selectedAttachment.file_name || "PDF"} url={selectedAttachment.viewUrl} />
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

        {modalType === "passwordChange" && (
          <AppModal title="Change password" onClose={() => setModalType(null)}>
            <PasswordChangeForm form={passwordForm} loading={loading} onChange={setPasswordForm} onSubmit={savePasswordSettings} />
          </AppModal>
        )}

        {modalType === "developerMode" && (
          <AppModal title="Developer mode" onClose={() => setModalType(null)}>
            <DeveloperModeForm form={developerForm} loading={loading} onChange={setDeveloperForm} onSubmit={saveDeveloperSettings} />
          </AppModal>
        )}

        <footer className="creatorCredit">Designed &amp; Created by Maksym Manko</footer>

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
  return createPortal(
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
    </div>,
    document.body,
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
          <button className="detailCloseButton" type="button" title="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function ProjectDetailOverlay({ activities = [], canDeleteTickets, canManage, changeOrders = [], companyId, currentVisit, dictation, dictationBusy = false, featureFlags = defaultFeatureFlags, files, getProfileName, onAddVisit, onClose, onDownloadArchive, onEditProject, onEditVisit, onEmailChangeOrder, onExportChangeOrder, onExportPdf, onExportSiteVisit, onExportTicketsExcel, onOpenAttachment, onOpenChangeOrder, onOpenSiteVisit, onOpenVisit, onRemoveActivity, onRemoveChangeOrder, onRemoveSiteVisit, onRemoveVisit, onUpdateChangeOrderStatus, onUpdateSiteVisitStatus, onUploaded, people, profileId, project, siteVisits = [], visits }) {
  const addresses = getProjectAddressOptions(project);
  const mainAddress = primaryProjectAddress(project);
  return (
    <DetailOverlayShell title={project.name} onClose={onClose}>
      <div className="detailHero projectDetailHeroTextOnly">
        <div>
          <span className="jobNumberPill">{project.job_number || "No job number"}</span>
          <h3>{project.name}</h3>
          <p>{project.description || "No description yet."}</p>
        </div>
        <div className="detailActionRow projectHeroActions">
          <a className="outlineLink" href={getGoogleMapsUrl(mainAddress)} target="_blank" rel="noreferrer">
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
        <ProjectFact icon={MapPin} label={addresses.length > 1 ? "Addresses" : "Address"} value={addresses.length > 1 ? addresses.map((item) => `${item.label}: ${item.address}`).join(" / ") : mainAddress || "Not set"} />
        <ProjectFact icon={UsersRound} label="PM / Owner" value={getProfileName(project.manager_id ?? project.created_by)} />
        <ProjectFact icon={UserRound} label="Contact" value={project.contact_name || "Not set"} />
        <ProjectFact icon={ClipboardCheck} label="Phone" value={project.contact_phone || "Not set"} />
        <ProjectFact icon={Mail} label="Client Email" value={project.contact_email || "Not set"} />
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

      {featureFlags.siteInspections && (
        <ProjectFieldReportSection
          getProfileName={getProfileName}
          kind="siteVisit"
          onDelete={canDeleteTickets ? onRemoveSiteVisit : null}
          onExport={onExportSiteVisit}
          onOpen={onOpenSiteVisit}
          onStatus={onUpdateSiteVisitStatus}
          records={siteVisits}
        />
      )}

      {featureFlags.changeOrders && (
        <ProjectFieldReportSection
          getProfileName={getProfileName}
          kind="changeOrder"
          onDelete={canDeleteTickets ? onRemoveChangeOrder : null}
          onEmail={onEmailChangeOrder}
          onExport={onExportChangeOrder}
          onOpen={onOpenChangeOrder}
          onStatus={onUpdateChangeOrderStatus}
          records={changeOrders}
        />
      )}

      <AttachmentSections
        featureFlags={featureFlags}
        files={files}
        onDownloadArchive={onDownloadArchive}
        onOpen={onOpenAttachment}
        profiles={people}
        uploader={
          canManage
            ? {
                attachments: files,
                companyId,
                dictation,
                dictationBusy,
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

function ProjectFieldReportSection({ getProfileName, kind, onDelete, onEmail, onExport, onOpen, onStatus, records = [] }) {
  const isSiteVisit = kind === "siteVisit";
  const title = getFieldReportLabel(kind, true);
  const Icon = isSiteVisit ? ClipboardCheck : FileBarChart2;
  const sortedRecords = [...records].sort((a, b) => {
    const left = isSiteVisit ? `${a.visit_date} ${a.start_time}` : `${a.order_date} ${a.order_time}`;
    const right = isSiteVisit ? `${b.visit_date} ${b.start_time}` : `${b.order_date} ${b.order_time}`;
    return left.localeCompare(right);
  });

  return (
    <div className="detailSection fieldReportProjectSection">
      <div className="panelSectionHeader">
        <h3>
          <Icon size={17} />
          {title}
        </h3>
        <span>{sortedRecords.length}</span>
      </div>
      {sortedRecords.length === 0 ? (
        <div className="emptyPanelState">No {title.toLowerCase()} saved for this project.</div>
      ) : (
        <div className="detailVisitGrid">
          {sortedRecords.map((record) => (
            <FieldReportCard
              getProfileName={getProfileName}
              key={record.id}
              kind={kind}
              onDelete={onDelete}
              onEmail={onEmail}
              onExport={onExport}
              onOpen={onOpen}
              onStatus={onStatus}
              project={null}
              record={record}
            />
          ))}
        </div>
      )}
    </div>
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
    site_inspection_saved: ClipboardCheck,
    site_inspection_updated: Edit3,
    site_inspection_completed: CheckCircle2,
    site_inspection_file_uploaded: Camera,
    change_order_created: FileBarChart2,
    change_order_file_uploaded: Camera,
    ticket_note_added: MessageSquarePlus,
    ticket_note_updated: Edit3,
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

function CrewStatusGroup({ emptyText, people = [], title, tone }) {
  return (
    <article className={`crewStatusGroup ${tone}`}>
      <strong>{title}</strong>
      {people.length > 0 ? (
        <div>
          {people.map((person) => (
            <span key={person.id}>{profileDisplayName(person, "Team member")}</span>
          ))}
        </div>
      ) : (
        <small>{emptyText}</small>
      )}
    </article>
  );
}

function VisitDetailOverlay({ canDeleteTickets, companyId, dictation, dictationBusy = false, equipment, featureFlags = defaultFeatureFlags, files, getProfileName, notes = [], onArrive, onClose, onComplete, onDownloadArchive, onEdit, onExportPdf, onOpenAttachment, onOpenNote, onRemove, onUploaded, people, profileId, profiles, project, safetyLocked = false, today = getWinnipegDateValue(), visit }) {
  const ticketAddress = getVisitAddress(visit, project);
  const safetyEnabled = normalizeFeatureFlags(featureFlags).safetyForm;
  const dateRelation = compareDateValue(visit.visit_date, today);
  const isPastVisit = dateRelation < 0;
  const isFutureVisit = dateRelation > 0;
  const canStartVisit = canStartPlannedVisit(visit, today);
  const canFinishVisit = canUseActiveVisitWorkflow(visit, today);
  const officeOverrideAvailable = canDeleteTickets && isPastVisit && visit.status === "on_site" && !visit.people_ids?.includes(profileId);
  const crewStatus = people.map((person) => {
    const arrived = safetyEnabled ? personHasSafetyFile(person, files) : ["on_site", "completed"].includes(visit.status);
    return {
      arrived,
      missingSafety: safetyEnabled && !arrived,
      person,
    };
  });
  const arrivedPeople = crewStatus.filter((item) => item.arrived).map((item) => item.person);
  const notArrivedPeople = crewStatus.filter((item) => !item.arrived).map((item) => item.person);
  const missingSafetyPeople = crewStatus.filter((item) => item.missingSafety).map((item) => item.person);
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
        <ProjectFact icon={MapPin} label="Address" value={ticketAddress || "Not set"} />
        <ProjectFact icon={UserRound} label="Contact" value={`${project.contact_name || "Not set"} ${project.contact_phone || ""}`} />
        <ProjectFact icon={ClipboardCheck} label="Assigned by" value={getProfileName(visit.assigned_by ?? visit.created_by)} />
        <ProjectFact icon={UsersRound} label="Team" value={people.map((person) => person.full_name || person.email).join(", ") || "No team assigned"} />
        <ProjectFact icon={Truck} label="Equipment" value={equipment.map((item) => item.name).join(", ") || "No equipment"} />
      </dl>

      {people.length > 0 && (
        <section className="crewArrivalCard">
          <div className="panelSectionHeader">
            <h3>Late Arrival / Partial Crew</h3>
            <span>{arrivedPeople.length}/{people.length}</span>
          </div>
          <div className="crewArrivalGrid">
            <CrewStatusGroup title="Arrived" tone="arrived" people={arrivedPeople} emptyText="No one marked arrived yet." />
            <CrewStatusGroup title="Not arrived yet" tone="waiting" people={notArrivedPeople} emptyText="Everyone is on site." />
            {safetyEnabled && <CrewStatusGroup title="Safety form missing" tone="missing" people={missingSafetyPeople} emptyText="All safety forms are signed." />}
          </div>
        </section>
      )}

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
          {canStartVisit && (
            <button className="arrivedButton" type="button" onClick={onArrive}>
              <ClipboardCheck size={18} />
              Arrived
            </button>
          )}
          {canFinishVisit && safetyLocked && (
            <button className="arrivedButton" type="button" onClick={onArrive}>
              <ClipboardCheck size={18} />
              Complete Safety Form
            </button>
          )}
          {canFinishVisit && !safetyLocked && (
            <button className="completeWorkButton" type="button" onClick={onComplete}>
              <CheckCircle2 size={18} />
              {officeOverrideAvailable ? "Office Close" : "Complete"}
            </button>
          )}
          {canFinishVisit && !safetyLocked && (
            <button type="button" onClick={() => onOpenNote?.(visit)}>
              <MessageSquarePlus size={18} />
              Add Note
            </button>
          )}
          {isFutureVisit && <span className="workflowHint">Future tickets are view-only until their scheduled date.</span>}
          {isPastVisit && visit.status === "planned" && <span className="workflowHint">Past planned tickets can be corrected by PM, Owner, or Office Manager.</span>}
          {isPastVisit && visit.status === "on_site" && !safetyLocked && (
            <span className="workflowHint">
              {officeOverrideAvailable ? "Office close will be saved on behalf of the assigned crew with current Winnipeg time." : "This Active ticket is from a previous day. Completion will use the current Winnipeg time."}
            </span>
          )}
        </div>
      ) : safetyLocked ? (
        <div className="thanksBox muted">Complete your Safety Form before ticket actions unlock.</div>
      ) : (
        <div className="thanksBox">Thank you. This ticket is Done.</div>
      )}

      <VisitNotesSection files={files} getProfileName={getProfileName} notes={notes} onEdit={(note) => onOpenNote?.(visit, note)} onOpenAttachment={onOpenAttachment} profiles={profiles} visit={visit} />

      <AttachmentSections
        featureFlags={featureFlags}
        files={files}
        onDownloadArchive={onDownloadArchive}
        onOpen={onOpenAttachment}
        profiles={profiles}
        uploader={{
          attachments: files,
          companyId,
          dictation,
          dictationBusy,
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

function VisitNotesSection({ files = [], getProfileName, notes = [], onEdit, onOpenAttachment, profiles = [], visit }) {
  const sortedNotes = [...notes].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return (
    <section className="visitNotesSection detailSection">
      <div className="panelSectionHeader">
        <h3>
          <MessageSquarePlus size={17} />
          Active Ticket Notes
        </h3>
        <span>{sortedNotes.length}</span>
      </div>
      {sortedNotes.length === 0 ? (
        <div className="emptyPanelState">No active ticket notes yet.</div>
      ) : (
        <div className="visitNotesList">
          {sortedNotes.map((note) => {
            const noteFiles = files.filter((file) => file.note_id === note.id);
            return (
              <article className="visitNoteCard" key={note.id}>
                <div className="visitNoteHeader">
                  <span>
                    <strong>{getProfileName(note.author_id, "Unknown")}</strong>
                    <small>{formatDateTimeLabel(note.updated_at || note.created_at)}</small>
                  </span>
                  {visit?.status === "on_site" && (
                    <button className="outlineButton" type="button" onClick={() => onEdit?.(note)}>
                      <Edit3 size={15} />
                      Edit
                    </button>
                  )}
                </div>
                {note.note_text && <p>{note.note_text}</p>}
                {noteFiles.length > 0 && (
                  <div className="attachmentStrip">
                    {noteFiles.map((file) => (
                      <AttachmentPreviewCard file={file} key={file.id} onOpen={onOpenAttachment} profiles={profiles} />
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FieldReportDetailOverlay({ canDelete = false, canManage, companyId, dictation, dictationBusy = false, files = [], getProfileName, kind, onClose, onDelete, onEdit, onEmail, onExport, onOpenAttachment, onStatus, onUploaded, profileId, project, record, profiles = [] }) {
  const isSiteVisit = kind === "siteVisit";
  const title = getFieldReportLabel(kind);
  const date = isSiteVisit ? record.visit_date : record.order_date;
  const timeText = isSiteVisit ? formatTimeRange(record.start_time, record.end_time) : formatTimeLabel(record.order_time);
  const completedText = record.completed_at ? formatDateTimeLabel(record.completed_at) : "Not completed";
  const createdText = record.created_at ? formatDateTimeLabel(record.created_at) : `${formatDateLabel(date)} / ${timeText}`;

  return (
    <DetailOverlayShell title={`${project.name} ${title}`} onClose={onClose}>
      <div className={`ticketHeaderCard fieldReportDetailHero ${kind}`}>
        <div>
          {isSiteVisit && <span className={`ticketStatus ${record.status}`}>{normalizeVisitStatus(record.status)}</span>}
          <h3>{title}</h3>
          <p>{formatDateLabel(date)} / {timeText}</p>
        </div>
        <div className="detailActionRow">
          {canManage && (
            <button className="outlineButton" type="button" onClick={() => onEdit?.(record)}>
              <Edit3 size={17} />
              Edit
            </button>
          )}
          <button className="outlineButton" type="button" onClick={() => onExport?.(record)}>
            <Download size={17} />
            Export PDF
          </button>
          {!isSiteVisit && (
            <button className="outlineButton" type="button" onClick={() => onEmail?.(record)}>
              <Mail size={17} />
              Email
            </button>
          )}
          {canManage && isSiteVisit && record.status === "planned" && (
            <button className="addButton" type="button" onClick={() => onStatus?.(record, "completed")}>
              <CheckCircle2 size={17} />
              Complete
            </button>
          )}
          {canDelete && (
            <button className="dangerAction" type="button" onClick={() => onDelete?.(record)}>
              <Trash2 size={17} />
              Remove
            </button>
          )}
        </div>
      </div>

      <dl className="detailFacts">
        <ProjectFact icon={FolderKanban} label="Project" value={project.name} />
        {!isSiteVisit && <ProjectFact icon={FileBarChart2} label="CO Number" value={record.order_number || nextChangeOrderNumber(project, [])} />}
        {!isSiteVisit && <ProjectFact icon={CircleGauge} label="Status" value={changeOrderStatusLabel(record.status)} badge />}
        <ProjectFact icon={ClipboardCheck} label="Created by" value={getProfileName(record.created_by, "Unknown")} />
        <ProjectFact icon={MapPin} label="Address" value={primaryProjectAddress(project) || "Not set"} />
        <ProjectFact icon={CheckCircle2} label={isSiteVisit ? "Completed" : "Created"} value={isSiteVisit ? completedText : createdText} />
        {!isSiteVisit && <ProjectFact icon={UserRound} label="Approved by" value={record.approved_by || "Not set"} />}
      </dl>

      <div className="ticketScopeGrid">
        {isSiteVisit && (
          <section>
            <h3>Project Work Description</h3>
            <p>{project.description || "No project work description yet."}</p>
          </section>
        )}
        <section>
          <h3>{title} Description</h3>
          <p>{record.description || "No description yet."}</p>
        </section>
        {!isSiteVisit && (
          <section>
            <h3>Proposed Additional Work</h3>
            <p>{record.proposed_work || "No proposed additional work yet."}</p>
          </section>
        )}
      </div>

      {!isSiteVisit && record.approval_signature && (
        <section className="fieldSignatureBlock">
          <h3>Approval Signature</h3>
          <img src={record.approval_signature} alt="Approval signature" />
        </section>
      )}

      <FieldReportFiles files={files} onOpen={onOpenAttachment} profiles={profiles} />

      {canManage && (
        <section className="attachmentUploadSection">
          <div className="panelSectionHeader">
            <h3>Add files</h3>
          </div>
          <DocumentUploaderShell
            attachments={files}
            changeOrderId={isSiteVisit ? null : record.id}
            companyId={companyId}
            dictation={dictation}
            dictationBusy={dictationBusy}
            profileId={profileId}
            projectId={project.id}
            siteVisitId={isSiteVisit ? record.id : null}
            visitId={null}
            onOpen={onOpenAttachment}
            onUploaded={onUploaded}
            showPreview={false}
          />
        </section>
      )}
    </DetailOverlayShell>
  );
}

function PersonDetailOverlay({ avatarUrl, canEdit, isSelf = false, onChangePassword, onClose, onEdit, person }) {
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
        {isSelf && (
          <button className="outlineButton" type="button" onClick={onChangePassword}>
            <KeyRound size={17} />
            Password
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
  if (isAttachmentPhoto(file)) {
    if (file.visit_id) return "Ticket photo";
    if (file.site_visit_id) return "Site Inspection photo";
    if (file.change_order_id) return "Change Order photo";
    return "Project photo";
  }
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

function AttachmentSections({ featureFlags = defaultFeatureFlags, files, onDownloadArchive, onOpen, profiles = [], uploader = null }) {
  const [openUploaderId, setOpenUploaderId] = useState("");
  const sectionRefs = useRef({});
  const flags = normalizeFeatureFlags(featureFlags);
  const groups = [
    flags.safetyForm ? { id: "safety", label: "Safety Forms", icon: FileText, uploadMode: "pdf", fileType: "safety_form", items: files.filter((file) => file.file_type === "safety_form") } : null,
    { id: "projectPhotos", label: "Project Photos", icon: Camera, uploadMode: "photo", fileType: "project_document", items: files.filter((file) => file.file_kind === "photo" && !file.visit_id && !file.site_visit_id && !file.change_order_id) },
    flags.beforeAfterPhotos ? { id: "before", label: "Before Photos", icon: Camera, uploadMode: "photo", fileType: "before_photo", items: files.filter((file) => file.file_type === "before_photo" && file.visit_id) } : null,
    flags.beforeAfterPhotos ? { id: "after", label: "After Photos", icon: Camera, uploadMode: "photo", fileType: "completion_photo", items: files.filter((file) => file.file_type === "completion_photo" && file.visit_id) } : null,
    { id: "pdf", label: "PDFs", icon: FileText, uploadMode: "pdf", fileType: "project_document", items: files.filter((file) => file.file_kind === "pdf" && file.file_type !== "safety_form") },
    { id: "excel", label: "Excel", icon: FileSpreadsheet, uploadMode: "excel", fileType: "project_document", items: files.filter((file) => file.file_kind === "excel") },
  ].filter(Boolean);

  return (
    <div className="attachmentSections">
      {groups.map((group) => {
        const Icon = group.icon;
        const canUploadGroup = Boolean(uploader && (uploader.visitId || !["before", "after"].includes(group.id)));
        function startDirectUpload() {
          flushSync(() => setOpenUploaderId(group.id));
          const section = sectionRefs.current[group.id];
          const inputType = group.uploadMode === "photo" ? "photo" : "document";
          section?.querySelector(`input[data-upload-input="${inputType}"]`)?.click();
        }
        return (
          <section className={`attachmentSection ${group.id}`} key={group.id} ref={(node) => {
            if (node) sectionRefs.current[group.id] = node;
            else delete sectionRefs.current[group.id];
          }}>
            <div className="attachmentSectionHeader">
              <h3>
                <Icon size={17} />
                {group.label}
                <span>{group.items.length}</span>
              </h3>
              <div className="attachmentSectionActions">
                {group.items.length > 0 && (
                  <button className="sectionArchiveButton" type="button" title={`Download ${group.label} archive`} onClick={() => onDownloadArchive?.(group.items, group.label)}>
                    <Download size={17} />
                  </button>
                )}
                {canUploadGroup && (
                  <button className="sectionAddButton" type="button" title={`Add ${group.label}`} onClick={startDirectUpload}>
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
            {canUploadGroup && openUploaderId === group.id && (
              <div className="sectionUploader directUploader" aria-hidden="true">
                <DocumentUploaderShell {...uploader} compact fileType={group.fileType} uploadMode={group.uploadMode} showPreview={false} />
              </div>
            )}
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

function FieldReportFiles({ files = [], onOpen, profiles = [] }) {
  const groupedFiles = files.reduce((groups, file) => {
    const key = file.folder_name || "Photos";
    if (!groups.has(key)) groups.set(key, { description: file.folder_description || "", items: [] });
    const group = groups.get(key);
    if (!group.description && file.folder_description) group.description = file.folder_description;
    group.items.push(file);
    return groups;
  }, new Map());

  return (
    <div className="attachmentSections fieldReportFiles">
      {[...groupedFiles.entries()].length === 0 && <div className="emptyPanelState">No photos or files saved yet.</div>}
      {[...groupedFiles.entries()].map(([folderName, group]) => (
        <section className="attachmentSection" key={folderName}>
          <h3>
            <Camera size={17} />
            {folderName}
            <span>{group.items.length}</span>
          </h3>
          {group.description && <p className="folderDescriptionText">{group.description}</p>}
          <div className="attachmentStrip">
            {group.items.map((file) => (
              <AttachmentPreviewCard file={file} key={file.id} onOpen={onOpen} profiles={profiles} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SafetyFormModal({ dictation, dictationBusy = false, form, loading, onChange, onSubmit, project, team, template = defaultSafetyTemplate, visit }) {
  const normalizedTemplate = normalizeSafetyTemplate(template);
  const responses = { ...emptySafetyResponses(normalizedTemplate), ...(form.responses ?? {}) };
  const presentIds = form.presentIds?.length ? form.presentIds : team.map((person) => person.id);
  const presentTeam = team.filter((person) => presentIds.includes(person.id));
  const absentTeam = team.filter((person) => !presentIds.includes(person.id));
  const signaturesReady = presentTeam.length > 0 && presentTeam.every((person) => form.signatures[person.id]?.trim());
  const canSubmit = safetyTemplateHasRequiredResponses(normalizedTemplate, responses) && signaturesReady;
  const currentTime = formatTimeLabel(getWinnipegTimeValue());

  function updateResponse(objectId, value) {
    onChange({ ...form, responses: { ...responses, [objectId]: value } });
  }

  function toggleTemplateCheckbox(object, itemId) {
    const current = responses[object.id] ?? { checked: [], details: {} };
    const set = new Set(current.checked ?? []);
    if (set.has(itemId)) set.delete(itemId);
    else set.add(itemId);
    updateResponse(object.id, { ...current, checked: [...set], details: current.details ?? {} });
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
        <span>{getVisitAddress(visit, project)}</span>
        <span>{formatDateLabel(visit.visit_date)} · Current time {currentTime}</span>
      </div>

      {normalizedTemplate.objects.map((object) => (
        <SafetyTemplateResponseObject
          dictation={dictation}
          key={object.id}
          object={object}
          onChange={(value) => updateResponse(object.id, value)}
          onToggleCheckbox={(itemId) => toggleTemplateCheckbox(object, itemId)}
          value={responses[object.id]}
        />
      ))}

      <fieldset className="pickerList safetySwitchList attendanceList">
        <legend>Who is on site?</legend>
        {team.length === 0 ? (
          <span className="mutedLine">No team members assigned to this ticket.</span>
        ) : (
          team.map((person) => (
            <div className={`safetySwitch ${presentIds.includes(person.id) ? "checked" : ""}`} key={person.id}>
              <button className="safetySwitchButton" type="button" onClick={() => togglePresent(person.id)}>
                <span className="switchTrack" aria-hidden="true">
                  <span />
                </span>
                <strong>{person.full_name || person.email || "Team member"}</strong>
              </button>
            </div>
          ))
        )}
        {absentTeam.length > 0 && <small className="attendanceNote">Absent team members will need their own Safety Form when they arrive.</small>}
      </fieldset>

      <div className="signatureStack">
        <h3>Team signatures</h3>
        {team.length === 0 ? (
          <div className="emptyPanelState">No team members assigned to this ticket.</div>
        ) : presentTeam.length === 0 ? (
          <div className="emptyPanelState">Select at least one team member who is on site.</div>
        ) : (
          presentTeam.map((person) => (
            <div className="signatureAgreement" key={person.id}>
              <p>Do not Sign untill you understand and agree with the PSI</p>
              <SignaturePad
                label={person.full_name || person.email || "Team member"}
                onChange={(dataUrl) =>
                  onChange({
                    ...form,
                    signatures: { ...form.signatures, [person.id]: dataUrl },
                  })
                }
                value={form.signatures[person.id] || ""}
              />
            </div>
          ))
        )}
      </div>

      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || dictationBusy || !canSubmit}>
          <Save size={18} />
          {loading ? "Saving PDF..." : "Save Safety PDF"}
        </button>
      </div>
    </form>
  );
}

function SafetyTemplateResponseObject({ dictation, object, onChange, onToggleCheckbox, value }) {
  const requiredLabel = object.required ? `${object.title} *` : object.title;

  if (object.type === "text") {
    return (
      <section className="safetyTemplateText">
        <strong>{object.title}</strong>
        <p>{object.body}</p>
      </section>
    );
  }

  if (object.type === "checkboxes") {
    const checked = new Set(value?.checked ?? []);
    const details = value?.details ?? {};
    return (
      <fieldset className="pickerList safetySwitchList safetyTemplateCheckboxes">
        <legend>{requiredLabel}</legend>
        {object.items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <div className={`safetySwitch safetyTemplateCheckbox ${isChecked ? "checked" : ""} ${item.details && isChecked ? "withDetails" : ""}`} key={item.id}>
              <button className="safetySwitchButton" type="button" onClick={() => onToggleCheckbox(item.id)}>
                <span className="switchTrack" aria-hidden="true">
                  <span />
                </span>
                <strong>{item.label}</strong>
              </button>
              {item.details && isChecked && (
                <span className="checkboxDetailField">
                  <VoiceTextInput
                    dictation={dictation}
                    placeholder="Add details..."
                    value={details[item.id] ?? ""}
                    onChange={(nextValue) =>
                      onChange({
                        ...(value ?? { checked: [], details: {} }),
                        details: { ...details, [item.id]: nextValue },
                      })
                    }
                  />
                </span>
              )}
            </div>
          );
        })}
      </fieldset>
    );
  }

  if (object.type === "select") {
    return (
      <FormField label={requiredLabel}>
        <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={object.required}>
          <option value="">Select...</option>
          {object.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  return (
    <FormField label={requiredLabel}>
      <VoiceTextArea dictation={dictation} placeholder={object.placeholder || "Type notes here..."} required={object.required} value={value ?? ""} onChange={onChange} />
    </FormField>
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

function PhotoStepModal({ captions = {}, dictation, dictationBusy = false, files = [], label, loading, onCaption, onFiles, onSubmit }) {
  const inputRef = useRef(null);
  const selectedFiles = Array.isArray(files) ? files : typeof files?.[Symbol.iterator] === "function" ? [...files] : [];

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <div className="workflowCallout">
        <ImagePlus size={22} />
        <span>{label}</span>
      </div>
      <button className="fileDropControl" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={22} />
        <strong>Select photos</strong>
        <span>{selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected` : "JPG, PNG, or WebP"}</span>
      </button>
      <input ref={inputRef} className="hiddenFileInput" accept="image/jpeg,image/png,image/webp" multiple type="file" onChange={(event) => onFiles([...event.target.files])} />
      <div className="selectedFiles">
        {selectedFiles.map((file) => {
          const key = fileInputKey(file);
          return (
            <SelectedPhotoCaptionCard caption={captions[key] || ""} dictation={dictation} file={file} key={key} onCaption={(value) => onCaption?.(key, value)} />
          );
        })}
      </div>
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || dictationBusy || selectedFiles.length === 0}>
          <Upload size={18} />
          {loading ? "Uploading..." : "Save Photos"}
        </button>
      </div>
    </form>
  );
}

function CompleteVisitModal({ dictation, dictationBusy = false, form, loading, onChange, onSubmit, requirePhotos = true }) {
  const inputRef = useRef(null);
  const selectedFiles = Array.isArray(form.files) ? form.files : [];

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <FormField label="Completion comments">
        <VoiceTextArea dictation={dictation} placeholder="Describe completed work, issues, materials, office notes..." value={form.notes} onChange={(value) => onChange({ ...form, notes: value })} />
      </FormField>
      {requirePhotos && (
        <>
          <div className="workflowCallout">
            <ImagePlus size={22} />
            <span>Upload at least one after photo before completing the ticket.</span>
          </div>
          <button className="fileDropControl" type="button" onClick={() => inputRef.current?.click()}>
            <Upload size={22} />
            <strong>Select after photos</strong>
            <span>{selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected` : "JPG, PNG, or WebP"}</span>
          </button>
          <input ref={inputRef} className="hiddenFileInput" accept="image/jpeg,image/png,image/webp" multiple type="file" onChange={(event) => onChange({ ...form, files: [...event.target.files] })} />
          <div className="selectedFiles">
            {selectedFiles.map((file) => {
              const key = fileInputKey(file);
              return (
                <SelectedPhotoCaptionCard
                  caption={form.captions?.[key] || ""}
                  dictation={dictation}
                  file={file}
                  key={key}
                  onCaption={(value) => onChange({ ...form, captions: { ...form.captions, [key]: value } })}
                />
              );
            })}
          </div>
        </>
      )}
      <div className="formActions wide">
        <button className="addButton completeWorkButton" type="submit" disabled={loading || dictationBusy || (requirePhotos && form.files.length === 0)}>
          <CheckCircle2 size={18} />
          {loading ? "Finishing..." : "Finish Work"}
        </button>
      </div>
    </form>
  );
}

function VisitNoteModal({ dictation, dictationBusy = false, form, loading, onChange, onSubmit }) {
  const selectedFiles = Array.isArray(form.files) ? form.files : [];

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <FormField label="Note">
        <VoiceTextArea dictation={dictation} placeholder="Add a quick note about the active ticket..." value={form.note_text} onChange={(value) => onChange({ ...form, note_text: value })} />
      </FormField>
      <label className="fileDropControl">
        <Upload size={22} />
        <strong>Add photos</strong>
        <span>{selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected` : "Optional JPG, PNG, or WebP"}</span>
        <input accept="image/jpeg,image/png,image/webp" multiple type="file" onChange={(event) => onChange({ ...form, files: [...event.target.files], captions: {} })} />
      </label>
      <div className="selectedFiles">
        {selectedFiles.map((file) => {
          const key = fileInputKey(file);
          return (
            <SelectedPhotoCaptionCard
              caption={form.captions?.[key] || ""}
              dictation={dictation}
              file={file}
              key={key}
              onCaption={(value) => onChange({ ...form, captions: { ...(form.captions ?? {}), [key]: value } })}
            />
          );
        })}
      </div>
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || dictationBusy || (!form.note_text.trim() && selectedFiles.length === 0)}>
          <Save size={18} />
          {loading ? "Saving..." : "Save Note"}
        </button>
      </div>
    </form>
  );
}

function SiteVisitForm({ dictation, dictationBusy = false, form, loading, onChange, onSubmit, projects = [] }) {
  return (
    <form className="stackForm twoColumns fieldReportForm" onSubmit={onSubmit}>
      <FormField label="Project">
        <ProjectSearchSelect projects={projects} value={form.project_id} onChange={(projectId) => onChange({ ...form, project_id: projectId })} />
      </FormField>
      <DateField label="Inspection date" value={form.visit_date} onChange={(date) => onChange({ ...form, visit_date: date })} />
      <FormField label="Status">
        <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value })}>
          <option value="planned">Planned</option>
          <option value="completed">Completed</option>
        </select>
      </FormField>
      {form.status === "planned" && (
        <>
          <FormField label="Start time">
            <select required value={form.start_time} onChange={(event) => onChange({ ...form, start_time: event.target.value })}>
              {timePickerOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="End time">
            <select required value={form.end_time} onChange={(event) => onChange({ ...form, end_time: event.target.value })}>
              {timePickerOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        </>
      )}
      <FormField label="Inspection description">
        <VoiceTextArea dictation={dictation} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      </FormField>
      <FieldPhotoFoldersEditor dictation={dictation} form={form} onChange={onChange} />
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || dictationBusy || !form.project_id}>
          <Save size={18} />
          {loading ? "Saving..." : "Save Site Inspection"}
        </button>
      </div>
    </form>
  );
}

function ChangeOrderForm({ changeOrders = [], dictation, dictationBusy = false, form, loading, onChange, onSubmit, projects = [] }) {
  const selectedProject = projects.find((project) => project.id === form.project_id);
  const previewNumber = form.order_number || nextChangeOrderNumber(selectedProject, changeOrders);
  const nowLabel = `${formatDateLabel(form.order_date || getWinnipegDateValue())} / ${formatTimeLabel(form.order_time || getWinnipegTimeValue())}`;
  const isApproved = form.status === "approved";
  return (
    <form className="stackForm twoColumns fieldReportForm" onSubmit={onSubmit}>
      <FormField label="Project">
        <ProjectSearchSelect projects={projects} value={form.project_id} onChange={(projectId) => onChange({ ...form, project_id: projectId })} />
      </FormField>
      <FormField label="CO number">
        <input readOnly value={form.project_id ? previewNumber : "Select project first"} />
      </FormField>
      <FormField label="Created">
        <input readOnly value={nowLabel} />
      </FormField>
      <div className="wide changeOrderStatusPicker">
        <span>Change Order status</span>
        <div>
          {[
            ["requested", "Requested"],
            ["approved", "Approved"],
          ].map(([value, label]) => (
            <button className={form.status === value ? "active" : ""} key={value} type="button" onClick={() => onChange({ ...form, status: value })}>
              <i className={`projectStatusDot ${value === "approved" ? "completed" : "planning"}`} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <FormField label="Change description">
        <VoiceTextArea dictation={dictation} value={form.description} onChange={(value) => onChange({ ...form, description: value })} />
      </FormField>
      <FormField label="Proposed Additional Work">
        <VoiceTextArea dictation={dictation} value={form.proposed_work} onChange={(value) => onChange({ ...form, proposed_work: value })} />
      </FormField>
      <FieldPhotoFoldersEditor dictation={dictation} form={form} onChange={onChange} />
      {isApproved && (
        <>
          <FormField label="Approved by">
            <input required value={form.approved_by} onChange={(event) => onChange({ ...form, approved_by: event.target.value })} />
          </FormField>
          <div className="wide">
            <SignaturePad label="Approval digital signature" value={form.approval_signature} onChange={(dataUrl) => onChange({ ...form, approval_signature: dataUrl })} />
          </div>
        </>
      )}
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || dictationBusy || !form.project_id || (isApproved && (!form.approved_by.trim() || !form.approval_signature))}>
          <Save size={18} />
          {loading ? "Saving..." : "Save Change Order"}
        </button>
      </div>
    </form>
  );
}

function FieldPhotoFoldersEditor({ dictation, form, onChange }) {
  const folders = form.folders ?? [];
  const selectedFiles = form.files ?? [];

  function updateFolder(folderId, patch) {
    onChange({
      ...form,
      folders: folders.map((folder) => (folder.id === folderId ? { ...folder, ...patch } : folder)),
    });
  }

  function removeFolder(folderId) {
    onChange({
      ...form,
      folders: folders.filter((folder) => folder.id !== folderId),
    });
  }

  return (
    <section className="fieldPhotoFolders wide">
      <div className="panelSectionHeader">
        <h3>Photos</h3>
        <button type="button" onClick={() => onChange({ ...form, folders: [...folders, makePhotoFolder(folders.length + 1)] })}>
          <Plus size={15} />
          Add Folder
        </button>
      </div>
      <div className="fieldPhotoFolder plainPhotos">
        <label className="fileDropControl">
          <Upload size={22} />
          <strong>Select photos</strong>
          <span>{selectedFiles.length ? `${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} selected` : "JPG, PNG, or WebP"}</span>
          <input
            accept="image/jpeg,image/png,image/webp"
            multiple
            type="file"
            onChange={(event) => onChange({ ...form, files: [...event.target.files], captions: {} })}
          />
        </label>
        <div className="selectedFiles">
          {selectedFiles.map((file) => {
            const key = fileInputKey(file);
            return (
              <SelectedPhotoCaptionCard
                caption={form.captions?.[key] || ""}
                dictation={dictation}
                file={file}
                key={key}
                onCaption={(value) => onChange({ ...form, captions: { ...(form.captions ?? {}), [key]: value } })}
              />
            );
          })}
        </div>
      </div>
      {folders.length === 0 && <div className="formHint">Folders are optional. Use Add Folder only when photos need separate sections in the PDF.</div>}
      {folders.map((folder, index) => (
        <div className="fieldPhotoFolder" key={folder.id}>
          <div className="fieldPhotoFolderHeader">
            <strong>Folder {index + 1}</strong>
            <button type="button" onClick={() => removeFolder(folder.id)}>
              <Trash2 size={15} />
              Remove
            </button>
          </div>
          <div className="twoColumns">
            <FormField label="Folder name">
              <input placeholder="Optional" value={folder.name} onChange={(event) => updateFolder(folder.id, { name: event.target.value })} />
            </FormField>
            <FormField label="Folder description">
              <VoiceTextInput dictation={dictation} placeholder="Optional" value={folder.description} onChange={(value) => updateFolder(folder.id, { description: value })} />
            </FormField>
          </div>
          <label className="fileDropControl">
            <Upload size={22} />
            <strong>Select photos</strong>
            <span>{folder.files?.length ? `${folder.files.length} photo${folder.files.length === 1 ? "" : "s"} selected` : "JPG, PNG, or WebP"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              multiple
              type="file"
              onChange={(event) => updateFolder(folder.id, { files: [...event.target.files], captions: {} })}
            />
          </label>
          <div className="selectedFiles">
            {(folder.files ?? []).map((file) => {
              const key = fileInputKey(file);
              return (
                <SelectedPhotoCaptionCard
                  caption={folder.captions?.[key] || ""}
                  dictation={dictation}
                  file={file}
                  key={key}
                  onCaption={(value) => updateFolder(folder.id, { captions: { ...(folder.captions ?? {}), [key]: value } })}
                />
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function SelectedPhotoCaptionCard({ caption, dictation, file, onCaption }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="selectedFileWithCaption photoFileWithCaption">
      {previewUrl && <img src={previewUrl} alt="" />}
      <span>{file.name}</span>
      <VoiceTextInput dictation={dictation} placeholder="Photo note..." value={caption} onChange={onCaption} />
    </label>
  );
}

function ScheduleView({ assignmentsReady, availableEquipment = [], availablePeople = [], avatarUrls, canDeleteTickets, equipmentRows, peopleRows, projectRows = [], projects = [], scheduleMode, selectedDate, setScheduleMode, setSelectedDate, visits = [], onAdd, onAssignEquipment, onAssignPerson, onAssignPeopleGroup, onCreateVisitFromDrop, onDropAssignment, onOpenPerson, onOpenProject, onRemoveEquipmentFromVisit, onRemovePersonFromVisit, onRemoveVisit, onSelect }) {
  const [dragPreview, setDragPreview] = useState(null);
  const [peopleGroupDrag, setPeopleGroupDrag] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(selectedDate);
  const calendarWrapRef = useRef(null);
  const now = new Date();
  const today = getWinnipegDateValue(now);
  const winnipegTime = getWinnipegTimeValue(now);
  const [winnipegHour, winnipegMinute] = winnipegTime.split(":").map(Number);
  const nowHour = winnipegHour + winnipegMinute / 60;
  const showNow = selectedDate === today && nowHour >= scheduleStartHour && nowHour <= scheduleEndHour;
  const nowRatio = Math.max(0, Math.min(1, (nowHour - scheduleStartHour) / (scheduleEndHour - scheduleStartHour)));
  const nowLabel = formatTimeLabel(winnipegTime);
  const shiftCurrentView = (amount) => {
    if (scheduleMode === "month") setSelectedDate(shiftMonth(selectedDate, amount));
    else setSelectedDate(shiftDate(selectedDate, scheduleMode === "week" ? amount * 7 : amount));
  };
  const openDay = (date) => {
    setSelectedDate(date);
    setScheduleMode("day");
  };
  const jumpToToday = () => openDay(getWinnipegDateValue());
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
          {projectRows.length === 0 && (
            <EmptyScheduleDropZone
              dragPreview={dragPreview}
              onCreateVisitFromDrop={onCreateVisitFromDrop}
              setDragPreview={setDragPreview}
            />
          )}

          <ResourceGroup avatarUrls={avatarUrls} canDeleteTickets={canDeleteTickets} dragPreview={dragPreview} peopleGroupDrag={peopleGroupDrag} setDragPreview={setDragPreview} title="Projects" count={projectRows.length} icon={FolderKanban} rows={projectRows} selectedDate={selectedDate} visits={visits} onAssignEquipment={onAssignEquipment} onAssignPerson={onAssignPerson} onAssignPeopleGroup={onAssignPeopleGroup} onCreateVisitFromDrop={onCreateVisitFromDrop} onDropAssignment={onDropAssignment} onOpenPerson={onOpenPerson} onOpenProject={onOpenProject} onRemoveVisit={onRemoveVisit} onSelect={onSelect} />
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

function EmptyScheduleDropZone({ dragPreview, onCreateVisitFromDrop, setDragPreview }) {
  const acceptsAvailablePeople = (event) => event.dataTransfer.types.includes("application/x-buildcore-person") || event.dataTransfer.types.includes("application/x-buildcore-person-group");
  const updatePreview = (event) => {
    if (!acceptsAvailablePeople(event)) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const duration = 10;
    const rawStart = scheduleStartHour + percent * (scheduleEndHour - scheduleStartHour);
    const start = Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, Math.round(rawStart * 4) / 4));
    const end = start + duration;
    setDragPreview?.({
      rowId: "__empty__",
      left: ((start - scheduleStartHour) / (scheduleEndHour - scheduleStartHour)) * 100,
      width: ((end - start) / (scheduleEndHour - scheduleStartHour)) * 100,
      label: `New ticket ${formatTimeRange(toTimeValue(start), toTimeValue(end))}`,
    });
  };

  return (
    <div className="emptyScheduleDropZone">
      <div className="emptyScheduleResource">
        <FolderKanban size={18} />
        <span>Projects</span>
      </div>
      <div
        className="emptyScheduleTrack"
        onDragLeave={() => setDragPreview?.(null)}
        onDragOver={updatePreview}
        onDrop={(event) => {
          if (!acceptsAvailablePeople(event)) return;
          event.preventDefault();
          const personId = event.dataTransfer.getData("application/x-buildcore-person");
          const groupRaw = event.dataTransfer.getData("application/x-buildcore-person-group");
          const group = groupRaw ? JSON.parse(groupRaw) : null;
          setDragPreview?.(null);
          onCreateVisitFromDrop?.({
            clientX: event.clientX,
            groupLabel: group?.trade,
            personId,
            personIds: group?.personIds,
            trackElement: event.currentTarget,
          });
        }}
      >
        {dragPreview?.rowId === "__empty__" && <div className="dragPreview" style={{ left: `${dragPreview.left}%`, width: `${dragPreview.width}%` }}>{dragPreview.label}</div>}
        <div className="emptyTimeline">Drag an available person or group here to create a ticket.</div>
      </div>
    </div>
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

function ProjectsView({ canManage, getProfileName, onDelete, onEdit, onSelect, onStatusChange, projects }) {
  const [projectQuery, setProjectQuery] = useState("");
  const normalizedProjectQuery = normalizeProjectSearch(projectQuery);
  const filteredProjects = useMemo(() => {
    if (!normalizedProjectQuery) return projects;
    const terms = normalizedProjectQuery.split(/\s+/).filter(Boolean);
    return projects.filter((project) => {
      const addresses = normalizeProjectAddresses(project)
        .map((item) => `${item.label || ""} ${item.address || ""}`)
        .join(" ");
      const haystack = normalizeProjectSearch(
        [
          project.name,
          project.job_number,
          project.description,
          project.contact_name,
          project.contact_email,
          project.contact_phone,
          project.status,
          getProfileName(project.manager_id ?? project.created_by, ""),
          addresses,
        ].join(" "),
      );
      return terms.every((term) => haystack.includes(term));
    });
  }, [getProfileName, normalizedProjectQuery, projects]);

  return (
    <div className="listView projectsListView">
      <div className="projectsListSearch">
        <div className="projectSearchInputWrap">
          <Search size={18} />
          <input
            autoComplete="off"
            placeholder="Search projects, job numbers, address..."
            type="search"
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
          />
          {projectQuery && (
            <button type="button" onClick={() => setProjectQuery("")}>
              <X size={16} />
            </button>
          )}
        </div>
        <span>{normalizedProjectQuery ? `${filteredProjects.length} of ${projects.length}` : `${projects.length} project${projects.length === 1 ? "" : "s"}`}</span>
      </div>
      {projects.length === 0 && <div className="emptyState">No projects yet. Press Add to create the first project.</div>}
      {projects.length > 0 && filteredProjects.length === 0 && <div className="emptyState">No matching projects found.</div>}
      {filteredProjects.map((project) => (
        <div className="listRow projectListRow" key={project.id}>
          <button className="rowMainButton" type="button" onClick={() => onSelect(project)}>
            <FolderKanban size={20} />
            <span>
              <strong>{project.name}</strong>
              <small>PM / Owner: {getProfileName(project.manager_id ?? project.created_by)}</small>
              <small>{project.job_number ? `${project.job_number} · ${primaryProjectAddress(project)}` : primaryProjectAddress(project)}</small>
            </span>
          </button>
          <div className="rowActions projectRowActions">
            <ProjectStatusControl canManage={canManage} project={project} onStatusChange={onStatusChange} />
            {canManage && (
              <>
              <button type="button" title="Edit project" onClick={() => onEdit(project)}>
                <Edit3 size={16} />
              </button>
              <button className="dangerIcon" type="button" title="Delete project" onClick={() => onDelete(project)}>
                <Trash2 size={16} />
              </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectStatusControl({ canManage, onStatusChange, project }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const wrapRef = useRef(null);
  const statusClass = projectStatusClass(project.status);

  useEffect(() => {
    if (!isOpen) return undefined;
    function updateMenuPosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 196;
      const estimatedHeight = 238;
      const gap = 8;
      const top = rect.bottom + gap + estimatedHeight > window.innerHeight
        ? Math.max(10, rect.top - estimatedHeight - gap)
        : rect.bottom + gap;
      setMenuStyle({
        left: Math.max(10, Math.min(window.innerWidth - menuWidth - 10, rect.right - menuWidth)),
        top,
        width: menuWidth,
      });
    }
    function handlePointerDown(event) {
      if (wrapRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      setIsOpen(false);
    }
    updateMenuPosition();
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const menu =
    isOpen && canManage
      ? createPortal(
          <div className="projectStatusMenu floatingProjectStatusMenu" ref={menuRef} style={menuStyle}>
            {Object.entries(projectStatusMap).map(([status, label]) => (
              <button
                className={status === project.status ? "active" : ""}
                key={status}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onStatusChange?.(project, status);
                }}
              >
                <i className={`projectStatusDot ${projectStatusClass(status)}`} />
                {label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="projectStatusControl" ref={wrapRef}>
      <button
        ref={buttonRef}
        className={`projectStatusChip ${statusClass}`}
        type="button"
        disabled={!canManage}
        title={canManage ? "Change project status" : normalizeStatus(project.status)}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span />
        {normalizeStatus(project.status)}
        {canManage && <ChevronDown size={13} />}
      </button>
      {menu}
    </div>
  );
}

function FieldReportsView({ emptyText, getProfileName, kind, onDelete, onEmail, onExport, onOpen, onStatus, projects = [], records = [] }) {
  const sortedRecords = [...records].sort((a, b) => {
    const left = kind === "siteVisit" ? `${a.visit_date} ${a.start_time}` : `${a.order_date} ${a.order_time}`;
    const right = kind === "siteVisit" ? `${b.visit_date} ${b.start_time}` : `${b.order_date} ${b.order_time}`;
    return right.localeCompare(left);
  });

  return (
    <div className="fieldReportList">
      {sortedRecords.length === 0 && <div className="emptyState">{emptyText}</div>}
      {sortedRecords.map((record) => {
        const project = projects.find((item) => item.id === record.project_id);
        return (
          <FieldReportCard
            getProfileName={getProfileName}
            key={record.id}
            kind={kind}
            onDelete={onDelete}
            onEmail={onEmail}
            onExport={onExport}
            onOpen={onOpen}
            onStatus={onStatus}
            project={project}
            record={record}
          />
        );
      })}
    </div>
  );
}

function FieldReportCard({ getProfileName, kind, onDelete, onEmail, onExport, onOpen, onStatus, project, record }) {
  const isSiteVisit = kind === "siteVisit";
  const title = getFieldReportLabel(kind);
  const date = isSiteVisit ? record.visit_date : record.order_date;
  const timeText = isSiteVisit ? formatTimeRange(record.start_time, record.end_time) : formatTimeLabel(record.order_time);

  return (
    <article className={`fieldReportCard ${kind}`}>
      <button className="fieldReportMain" type="button" onClick={() => onOpen?.(record)}>
        <span className="fieldReportIcon">{isSiteVisit ? <ClipboardCheck size={20} /> : <FileBarChart2 size={20} />}</span>
        <span>
          <strong>{project?.name || title}</strong>
          <small>{title} / {!isSiteVisit && record.order_number ? `${record.order_number} / ` : ""}{formatDateLabel(date)} / {timeText}</small>
          <em>{record.description || "No description yet."}</em>
        </span>
        <i className={`ticketStatus ${isSiteVisit ? record.status : normalizeChangeOrderStatus(record.status)}`}>{isSiteVisit ? normalizeVisitStatus(record.status) : changeOrderStatusLabel(record.status)}</i>
      </button>
      <div className="fieldReportActions">
        <small>Created by {getProfileName(record.created_by, "Unknown")}</small>
        <button className="outlineButton" type="button" onClick={() => onExport?.(record)}>
          <Download size={16} />
          PDF
        </button>
        {!isSiteVisit && (
          <button className="outlineButton" type="button" onClick={() => onEmail?.(record)}>
            <Mail size={16} />
            Email
          </button>
        )}
        {isSiteVisit && record.status === "planned" && (
          <button className="addButton" type="button" onClick={() => onStatus?.(record, "completed")}>
            <CheckCircle2 size={16} />
            Complete
          </button>
        )}
        {onDelete && (
          <button className="dangerAction" type="button" onClick={() => onDelete?.(record)}>
            <Trash2 size={16} />
            Remove
          </button>
        )}
      </div>
    </article>
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
    { id: "projectPhotos", label: "Project Photos", items: sortedFiles.filter((file) => file.file_kind === "photo" && !file.visit_id && !file.site_visit_id && !file.change_order_id) },
    flags.siteInspections ? { id: "siteVisitPhotos", label: "Site Inspection Photos", items: sortedFiles.filter((file) => file.file_kind === "photo" && file.site_visit_id) } : null,
    flags.changeOrders ? { id: "changeOrderPhotos", label: "Change Order Photos", items: sortedFiles.filter((file) => file.file_kind === "photo" && file.change_order_id) } : null,
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

function OverviewView({ data, getProfileName, getVisitFiles, onArrive, onComplete, onCreateChangeOrder, onDateChange, onOpenNote, onOpenVisit, profile, projects, selectedDate, today, visits }) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(selectedDate);
  const [weather, setWeather] = useState({ status: "idle", data: null });
  const calendarWrapRef = useRef(null);
  const assignedVisits = visits ?? [];
  const firstVisit = assignedVisits[0];
  const firstProject = firstVisit ? projects.find((project) => project.id === firstVisit.project_id) : null;
  const firstAddress = getVisitAddress(firstVisit, firstProject);
  const isToday = selectedDate === today;
  const setOverviewDate = (date) => onDateChange?.(date);
  const flags = normalizeFeatureFlags(data.featureFlags);

  function currentUserHasSafety(files, visit) {
    if (!flags.safetyForm) return true;
    if (!visit?.people_ids?.includes(profile?.id)) return true;
    return personHasSafetyFile(profile, files);
  }

  useEffect(() => {
    let alive = true;
    if (!firstAddress) {
      setWeather({ status: "idle", data: null });
      return undefined;
    }

    setWeather({ status: "loading", data: null });
    getWeatherForAddress(firstAddress)
      .then((data) => {
        if (alive) setWeather({ status: "ready", data });
      })
      .catch((error) => {
        if (alive) setWeather({ status: "error", message: error.message, data: null });
      });

    return () => {
      alive = false;
    };
  }, [firstAddress]);

  useEffect(() => {
    setPickerMonth(selectedDate);
  }, [selectedDate]);

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
    <div className="todayTickets">
      <section className="overviewDatePanel">
        <div>
          <span>Overview date</span>
          <strong>{isToday ? "Today" : formatDateLabel(selectedDate)}</strong>
        </div>
        <div className="overviewDateActions">
          <button className="overviewArrowButton previous" type="button" title="Previous day" onClick={() => setOverviewDate(shiftDate(selectedDate, -1))}>
            <ChevronLeft size={18} />
          </button>
          <div className="calendarPickerWrap overviewDatePicker" ref={calendarWrapRef}>
            <button className="dateDisplay" type="button" aria-label="Open overview calendar" onClick={() => setIsCalendarOpen((value) => !value)}>
              <Calendar size={17} />
              <span>{formatShortDate(selectedDate)}</span>
            </button>
            {isCalendarOpen && (
              <MiniCalendarPicker
                monthDate={pickerMonth}
                selectedDate={selectedDate}
                today={today}
                onClose={() => setIsCalendarOpen(false)}
                onMonthChange={setPickerMonth}
                onSelect={(date) => {
                  setOverviewDate(date);
                  setIsCalendarOpen(false);
                }}
              />
            )}
          </div>
          <button className="overviewArrowButton next" type="button" title="Next day" onClick={() => setOverviewDate(shiftDate(selectedDate, 1))}>
            <ChevronRight size={18} />
          </button>
          <button className="overviewTodayButton" type="button" onClick={() => setOverviewDate(today)}>
            Today
          </button>
        </div>
      </section>

      {assignedVisits.length === 0 && <div className="emptyState">{isToday ? "No visits assigned to you today." : `No visits assigned to you on ${formatDateLabel(selectedDate)}.`}</div>}
      {assignedVisits.map((visit) => {
        const project = projects.find((item) => item.id === visit.project_id);
        const files = getVisitFiles(visit);
        const hasCurrentUserSafety = currentUserHasSafety(files, visit);
        const dateRelation = compareDateValue(visit.visit_date, today);
        const isPastVisit = dateRelation < 0;
        const isFutureVisit = dateRelation > 0;
        const canStartVisit = canStartPlannedVisit(visit, today);
        const canFinishVisit = canUseActiveVisitWorkflow(visit, today);
        const safetyLocked = canFinishVisit && !hasCurrentUserSafety;
        const hasBefore = files.some((file) => file.file_type === "before_photo");
        const hasAfter = files.some((file) => file.file_type === "completion_photo");
        const sitePhone = project?.contact_phone || "";
        const callablePhone = sitePhone.replace(/[^\d+]/g, "");
        const assignedPeople = (data.people ?? []).filter((person) => visit.people_ids?.includes(person.id));
        const assignedEquipment = (data.equipment ?? []).filter((item) => visit.equipment_ids?.includes(item.id));
        const ticketAddress = getVisitAddress(visit, project);

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
                  ticketAddress ? (
                    <span className="factInlineActions">
                      <span>{ticketAddress}</span>
                      <a href={getGoogleMapsUrl(ticketAddress)} target="_blank" rel="noreferrer">
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
              <ProjectFact icon={ClipboardCheck} label="Checklist" value={`Safety ${hasCurrentUserSafety ? "done" : "needed"} / Before ${hasBefore ? "done" : "needed"} / After ${hasAfter ? "done" : "needed"}`} />
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

            {canStartVisit && (
              <div className="visitActions wideActions">
                <button className="arrivedButton" type="button" onClick={() => onArrive(visit)}>
                  <ClipboardCheck size={18} />
                  Arrived
                </button>
              </div>
            )}
            {safetyLocked && (
              <div className="visitActions wideActions">
                <button type="button" onClick={() => onArrive(visit)}>
                  <ClipboardCheck size={18} />
                  Complete Safety Form
                </button>
                <span className="workflowHint">You need your own Safety Form before ticket actions unlock.</span>
              </div>
            )}
            {canFinishVisit && !safetyLocked && (
              <div className="visitActions wideActions">
                <button type="button" onClick={() => onOpenNote?.(visit)}>
                  <MessageSquarePlus size={18} />
                  Add Note
                </button>
                <button type="button" onClick={() => onCreateChangeOrder?.(visit)}>
                  <FileBarChart2 size={18} />
                  Create Change Order
                </button>
                <button className="completeWorkButton" type="button" onClick={() => onComplete(visit)}>
                  <CheckCircle2 size={18} />
                  Complete Work
                </button>
              </div>
            )}
            {isPastVisit && visit.status === "on_site" && !safetyLocked && (
              <div className="thanksBox muted">This Active ticket is from a previous day. Completion will be saved with the current Winnipeg time.</div>
            )}
            {visit.status === "completed" && <div className="thanksBox">Thank you. Work is Done.</div>}
            {isFutureVisit && <div className="thanksBox muted">Future tickets are view-only until their scheduled date.</div>}
            {isPastVisit && visit.status === "planned" && <div className="thanksBox muted">Past planned tickets can be corrected by PM, Owner, or Office Manager.</div>}
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

function ServerStatusIndicator({ online, queueCount = 0 }) {
  const statusClass = queueCount > 0 ? "pending" : online ? "online" : "offline";
  return (
    <div className={`serverStatus ${statusClass}`} title={queueCount > 0 ? "Offline changes are waiting to sync" : online ? "Supabase server connected" : "Supabase server is not responding"}>
      <span className="serverStatusLight" />
      <span>
        <strong>{queueCount > 0 ? "Sync Pending" : online ? "Server Connected" : "Server Offline"}</strong>
        <small>{queueCount > 0 ? `${queueCount} offline item${queueCount === 1 ? "" : "s"}` : online ? "Supabase live" : "Check connection"}</small>
      </span>
    </div>
  );
}

function NotificationButton({ count = 0, mobile = false, onClick }) {
  return (
    <button className={mobile ? "notificationButton mobile" : "notificationButton"} type="button" title="Notifications" onClick={onClick}>
      <Bell size={mobile ? 20 : 19} />
      {count > 0 && <span className="notificationBadge">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}

function NotificationsPanel({ notifications = [], onOpen }) {
  const rows = [...notifications].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return (
    <div className="notificationsPanel">
      {rows.length === 0 ? (
        <div className="emptyPanelState">No notifications yet.</div>
      ) : (
        rows.map((item) => (
          <button className={item.read_at ? "notificationRow" : "notificationRow unread"} key={item.id} type="button" onClick={() => onOpen?.(item)}>
            <span className="notificationIcon">
              {item.type?.includes("change_order") ? <FileBarChart2 size={18} /> : item.type?.includes("note") ? <MessageSquarePlus size={18} /> : <Calendar size={18} />}
            </span>
            <span>
              <strong>{item.title || "Notification"}</strong>
              <small>{formatDateTimeLabel(item.created_at)}</small>
              <em>{item.message}</em>
            </span>
            {!item.read_at && <i />}
          </button>
        ))
      )}
    </div>
  );
}

function HelpCenter({ role = "" }) {
  const isBuilder = role === "builder";
  const tabs = [
    { id: "daily-flow", label: "Daily flow" },
    { id: "core-features", label: "Core features" },
    { id: "proof-exports", label: "Proof & exports" },
    { id: "mobile-field", label: "Mobile field mode" },
  ];
  const guideSections = isBuilder
    ? [
        {
          id: "daily-flow",
          eyebrow: "01",
          title: "Daily flow",
          intro: "Start from your assigned work, follow the ticket steps, and keep the office updated without extra calls.",
          cards: [
            { icon: Calendar, title: "Open today's work", text: "Use Schedule or Notifications to find the ticket assigned to you.", points: ["Check project name, address, time, work scope, crew, and equipment.", "Open attached photos, PDFs, or notes before work starts."] },
            { icon: CheckCircle2, title: "Work the ticket", text: "The ticket guides the field workflow in the right order.", points: ["Tap Arrived when you are on site.", "Complete Safety Form before other actions unlock.", "Upload Before Photos, add notes if needed, then Complete Work with After Photos."] },
          ],
        },
        {
          id: "core-features",
          eyebrow: "02",
          title: "Core features",
          intro: "Everything shown to builders is focused on the jobsite: schedule, notifications, safety, photos, notes, and files.",
          cards: [
            { icon: Search, title: "Search", text: "Find the right ticket, project, document, note, or file without digging.", points: ["Search by project name, file name, note, or work detail.", "Use results to jump straight into the right place."] },
            { icon: Bell, title: "Notifications", text: "See assignments, changes, reminders, and important notes.", points: ["The badge clears after you view notifications.", "History stays available when you need to look back."] },
            { icon: ClipboardCheck, title: "Safety", text: "Safety keeps the job record clean and protects everyone on site.", points: ["Read the PSI carefully.", "If you arrived late, complete your own Safety Form before continuing."] },
          ],
        },
        {
          id: "proof-exports",
          eyebrow: "03",
          title: "Proof & exports",
          intro: "Your uploads become part of the official project record.",
          cards: [
            { icon: Camera, title: "Photos and notes", text: "Before, After, and note photos stay connected to the correct ticket.", points: ["Use voice dictation when typing is inconvenient.", "Annotate photos to point out exact details."] },
            { icon: FileText, title: "Files and PDFs", text: "Open project files, PDFs, and photos directly from the ticket or project.", points: ["Review documents the office attached.", "Uploaded Safety Forms become signed PDF records."] },
          ],
        },
        {
          id: "mobile-field",
          eyebrow: "04",
          title: "Mobile field mode",
          intro: "The phone layout keeps the most important actions close and easy to tap on site.",
          cards: [
            { icon: Phone, title: "Built for the phone", text: "Schedule, Notifications, ticket actions, camera upload, dictation, and photo review are ready for field use.", points: ["Open the site on your phone during the day.", "If connection is weak, finish the action and let the app sync when internet returns."] },
          ],
        },
      ]
    : [
        {
          id: "daily-flow",
          eyebrow: "01",
          title: "Daily flow",
          intro: "Run the company day from one calm place: plan work, watch the field, catch problems early, and finish with a clean record.",
          cards: [
            { icon: Calendar, title: "Morning dispatch", text: "Open Schedule to see who is working, where they are going, and what is still active.", points: ["Assign one worker, a crew group, or equipment by dragging onto a project time slot.", "Create tickets with project, address, date, time, work scope, people, and equipment."] },
            { icon: Bell, title: "Live office awareness", text: "Notifications surface notes, assignments, late arrivals, partial crew, old active tickets, and Change Order updates.", points: ["Catch issues before the end of the day.", "Reduce repeated check-in calls because the ticket shows current field status."] },
            { icon: CheckCircle2, title: "End-of-day cleanup", text: "Active tickets, missing safety, missing photos, and incomplete work are visible instead of hidden in messages.", points: ["Office override can close old active tickets when needed.", "Activity Feed records who changed what and when."] },
          ],
        },
        {
          id: "core-features",
          eyebrow: "02",
          title: "Core features",
          intro: "The core tools are built around how construction work is actually remembered: job numbers, addresses, crews, photos, safety, and field notes.",
          cards: [
            { icon: Search, title: "Search", text: "Search across projects, tickets, people, documents, notes, job numbers, addresses, file names, work scopes, and saved reports.", points: ["Use global Search to jump across the whole workspace.", "Use project picker search by name or job number while creating tickets, inspections, and Change Orders.", "Use Projects search for job number, address, contact, PM, status, or description."] },
            { icon: FolderKanban, title: "Projects and tickets", text: "Each project becomes the home for daily tickets, photos, PDFs, Excel files, Site Inspections, Change Orders, notes, and history.", points: ["Unique six-digit job numbers keep jobs easy to identify.", "Open a ticket to see crew, actual start and finish, safety, photos, notes, and completion."] },
            { icon: UsersRound, title: "People control", text: "Roles keep access clean. Office roles manage the company view. Builders only see the tools they need on site.", points: ["Approve accounts and assign roles.", "Set trades, availability, phone numbers, avatars, and profile details.", "Track late arrival, partial crew, and missing Safety Forms."] },
            { icon: ClipboardCheck, title: "Safety forms", text: "Safety becomes part of the workflow, not a separate paper chase.", points: ["Customize the PSI form in Developer Mode.", "Require workers to complete safety before continuing ticket actions.", "Saved Safety Forms become signed PDFs attached to the ticket."] },
          ],
        },
        {
          id: "proof-exports",
          eyebrow: "03",
          title: "Proof & exports",
          intro: "BuildCore turns field activity into organized proof for billing, client updates, internal review, and closeout.",
          cards: [
            { icon: Camera, title: "Photos and annotations", text: "Before, After, project, ticket, inspection, and Change Order photos stay attached to the right record.", points: ["Add notes by typing or voice dictation while details are fresh.", "Annotate photos with clean pen, arrows, shapes, text, undo, redo, and save."] },
            { icon: FileText, title: "PDF generation", text: "Generate ready-to-send documents from real project activity.", points: ["Export project summaries.", "Export ticket PDFs with work details, crew, time, notes, photos, and completion records.", "Export Safety Forms, Change Orders, and Site Inspections as clean PDFs."] },
            { icon: Download, title: "Archives and Excel", text: "Download exactly the files or spreadsheet data the office needs.", points: ["Download a full archive from a specific attachment block.", "Export ticket data to Excel for office review, billing support, or planning."] },
            { icon: FileBarChart2, title: "Change Orders", text: "Changed work becomes documented, reviewed, signed when approved, and connected to the job record.", points: ["Use Requested or Approved status.", "Add Proposed Additional Work, approved-by details, signature, and files."] },
          ],
        },
        {
          id: "mobile-field",
          eyebrow: "04",
          title: "Mobile field mode",
          intro: "The field team works from the phone they already carry. The office sees progress without waiting for a phone call.",
          cards: [
            { icon: Phone, title: "Jobsite workflow", text: "Builders open today's ticket, tap Arrived, complete Safety Form, upload Before Photos, add notes, and Complete Work with After Photos.", points: ["The workflow keeps important steps from being skipped.", "The office gets cleaner records with less back-and-forth."] },
            { icon: Upload, title: "Offline queue", text: "Weak connection should not turn into lost work.", points: ["Photo and work actions can wait locally.", "When the phone is online, queued work syncs back to Supabase."] },
          ],
        },
      ];

  return (
    <div className="helpCenter">
      <section className="helpHero">
        <span>{isBuilder ? "Field Guide Center" : "Owner Guide Center"}</span>
        <h3>{isBuilder ? "See the job. Sign safety. Add proof. Finish work." : "Plan the day. Control the field. Keep proof. Finish cleaner."}</h3>
        <p>{isBuilder ? "A focused guide for the tools builders use on site every day." : "A clear operating guide for owners, PMs, and office managers who want fewer loose ends and a cleaner company record."}</p>
        <div className="helpValueBadges">
          {(isBuilder ? ["Today's work", "Safety first", "Photo proof", "Notifications"] : ["Less phone calls", "Cleaner closeout", "Field accountability", "Ready-to-send PDFs"]).map((label) => (
            <em key={label}>{label}</em>
          ))}
        </div>
      </section>

      <nav className="helpTabs" aria-label="Help sections">
        {tabs.map((tab) => (
          <a href={`#help-${tab.id}`} key={tab.id}>{tab.label}</a>
        ))}
      </nav>

      <div className="helpGuideSections">
        {guideSections.map((section) => (
          <section className="helpGuideSection" id={`help-${section.id}`} key={section.id}>
            <div className="helpSectionIntro">
              <span>{section.eyebrow}</span>
              <h4>{section.title}</h4>
              <p>{section.intro}</p>
            </div>
            <div className="helpCardGrid">
              {section.cards.map((card) => {
                const Icon = card.icon;
                return (
                  <article className="helpFeatureCard" key={card.title}>
                    <Icon size={22} />
                    <div>
                      <h5>{card.title}</h5>
                      <p>{card.text}</p>
                      <ul>
                        {card.points.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SettingsHub({ canManage, canUseDeveloperMode, featureFlags = defaultFeatureFlags, onDeveloperMode, onNavigate }) {
  const flags = normalizeFeatureFlags(featureFlags);
  const quickLinks = [
    canManage ? { id: "people", label: "People", text: "Approve requests, roles, trades, availability.", icon: UsersRound } : null,
    canManage ? { id: "equipment", label: "Equipment", text: "Manage equipment avatars and units.", icon: Truck } : null,
    { id: "documents", label: "Documents", text: "Browse project files, photos, PDF, and Excel.", icon: FileText },
    flags.safetyForm ? { id: "safetyReports", label: "Safety Reports", text: "Open saved Safety Form PDFs.", icon: ClipboardCheck } : null,
  ].filter(Boolean);

  return (
    <div className="settingsHub">
      <section className="settingsSummaryPanel">
        <div className="settingsFeatureGrid">
          <span className={flags.safetyForm ? "featurePill on" : "featurePill off"}>Safety Form {flags.safetyForm ? "On" : "Off"}</span>
          <span className={flags.beforeAfterPhotos ? "featurePill on" : "featurePill off"}>Before / After Photos {flags.beforeAfterPhotos ? "On" : "Off"}</span>
          <span className={flags.siteInspections ? "featurePill on" : "featurePill off"}>Site Inspection {flags.siteInspections ? "On" : "Off"}</span>
          <span className={flags.changeOrders ? "featurePill on" : "featurePill off"}>Change Order {flags.changeOrders ? "On" : "Off"}</span>
          <span className={flags.testBots ? "featurePill on" : "featurePill off"}>Test Bots {flags.testBots ? "On" : "Off"}</span>
        </div>
      </section>

      <div className="settingsHubGrid">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <button className="settingsHubCard" key={item.id} type="button" onClick={() => onNavigate?.(item.id)}>
              <Icon size={20} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.text}</small>
              </span>
              <ChevronRight size={18} />
            </button>
          );
        })}
        {canUseDeveloperMode && (
          <button className="settingsHubCard developer" type="button" onClick={onDeveloperMode}>
            <Wrench size={20} />
            <span>
              <strong>Developer Mode</strong>
              <small>Feature switches, Safety Form, photos, inspections, Change Orders, and test bots.</small>
            </span>
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileEditForm({ avatarUrl, form, loading, onChange, onSubmit, profile }) {
  const previewProfile = { ...profile, avatar_emoji: form.removeAvatar ? "" : form.avatarEmoji };
  const previewUrl = form.removeAvatar || form.avatarEmoji ? "" : avatarUrl;
  return (
    <form className="settingsProfileForm" onSubmit={onSubmit}>
      <div className="settingsAvatarBlock">
        <Avatar profile={previewProfile} url={previewUrl} />
        <span>
          <strong>{profileDisplayName(profile, "Not signed in")}</strong>
          <small>{form.avatarFile?.name || (form.avatarEmoji ? "Emoji avatar selected" : profile ? roleLabel(profile.role) : "No profile yet")}</small>
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
        <input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => onChange({ ...form, avatarFile: event.target.files?.[0] ?? null, avatarEmoji: "", removeAvatar: false })} />
      </label>
      <EmojiAvatarPicker
        label="Or choose emoji avatar"
        selected={form.removeAvatar ? "" : form.avatarEmoji}
        onSelect={(emoji) => onChange({ ...form, avatarEmoji: emoji, avatarFile: null, removeAvatar: false })}
      />
      <label className="checkLine switchLine">
        <input type="checkbox" checked={form.removeAvatar} onChange={(event) => onChange({ ...form, removeAvatar: event.target.checked, avatarFile: null, avatarEmoji: event.target.checked ? "" : form.avatarEmoji })} />
        <span className="switchTrack" aria-hidden="true">
          <span />
        </span>
        Remove avatar and use automatic default icon
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

function PasswordChangeForm({ form, loading, onChange, onSubmit, submitLabel = "Save password" }) {
  return (
    <form className="settingsProfileForm" onSubmit={onSubmit}>
      <div className="settingsAvatarBlock passwordHeroBlock">
        <span className="fieldReportIcon">
          <KeyRound size={22} />
        </span>
        <span>
          <strong>Change account password</strong>
          <small>Your current Supabase session will stay remembered on this device.</small>
        </span>
      </div>
      <FormField label="New password">
        <input autoComplete="new-password" required minLength={8} type="password" value={form.password} onChange={(event) => onChange({ ...form, password: event.target.value })} />
      </FormField>
      <FormField label="Confirm password">
        <input autoComplete="new-password" required minLength={8} type="password" value={form.confirm} onChange={(event) => onChange({ ...form, confirm: event.target.value })} />
      </FormField>
      <div className="formActions">
        <button className="addButton" type="submit" disabled={loading}>
          <Save size={18} />
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function EmojiAvatarPicker({ label = "Emoji avatar", onSelect, selected }) {
  return (
    <div className="emojiAvatarPicker">
      <div>
        <strong>{label}</strong>
        <small>Use this when you do not want to upload a photo.</small>
      </div>
      <div className="emojiAvatarGrid" role="listbox" aria-label={label}>
        {profileEmojiOptions.map((emoji) => (
          <button
            aria-label={`Use ${emoji} avatar`}
            aria-selected={selected === emoji}
            className={selected === emoji ? "emojiAvatarOption active" : "emojiAvatarOption"}
            key={emoji}
            type="button"
            onClick={() => onSelect?.(selected === emoji ? "" : emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeveloperModeForm({ form, loading, onChange, onSubmit }) {
  const [isSafetyBuilderOpen, setIsSafetyBuilderOpen] = useState(false);
  const safetyTemplate = normalizeSafetyTemplate(form.safetyTemplate);

  return (
    <form className="developerModeForm" onSubmit={onSubmit}>
      <DeveloperSwitch
        checked={form.safetyForm}
        description="When off, Arrived skips the digital safety form and Safety Reports are hidden without deleting saved reports."
        label="Safety Form"
        onChange={(checked) => onChange({ ...form, safetyForm: checked })}
      />
      {form.safetyForm && (
        <div className="developerCustomizeBlock">
          <button className="outlineButton" type="button" onClick={() => setIsSafetyBuilderOpen((current) => !current)}>
            <Edit3 size={16} />
            Customize Safety Form
          </button>
          {isSafetyBuilderOpen && (
            <SafetyTemplateBuilder
              template={safetyTemplate}
              onChange={(nextTemplate) => onChange({ ...form, safetyTemplate: normalizeSafetyTemplate(nextTemplate) })}
            />
          )}
        </div>
      )}
      <DeveloperSwitch
        checked={form.beforeAfterPhotos}
        description="When off, Arrived and Complete no longer require before or after photos. Existing photos stay saved."
        label="Before / After Photos"
        onChange={(checked) => onChange({ ...form, beforeAfterPhotos: checked })}
      />
      <DeveloperSwitch
        checked={form.siteInspections}
        description="When off, Site Inspection is hidden from navigation, projects, documents, search, and schedule without deleting saved inspections."
        label="Site Inspection"
        onChange={(checked) => onChange({ ...form, siteInspections: checked })}
      />
      <DeveloperSwitch
        checked={form.changeOrders}
        description="When off, Change Orders are hidden from navigation, projects, documents, search, and schedule without deleting saved orders."
        label="Change Order"
        onChange={(checked) => onChange({ ...form, changeOrders: checked })}
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

function SafetyTemplateBuilder({ onChange, template }) {
  const normalizedTemplate = normalizeSafetyTemplate(template);

  function updateObjects(objects) {
    onChange({ version: 1, objects });
  }

  function updateObject(index, nextObject) {
    updateObjects(normalizedTemplate.objects.map((object, objectIndex) => (objectIndex === index ? nextObject : object)));
  }

  function addObject(type) {
    const base = {
      id: makeStableId(`safety-${type}`),
      required: false,
      title: type === "text" ? "Information" : type === "checkboxes" ? "Checklist" : type === "select" ? "Selection" : "Text field",
      type,
    };
    const object =
      type === "checkboxes"
        ? { ...base, items: [{ id: makeStableId("checkbox"), label: "New checkbox", details: false }] }
        : type === "select"
          ? { ...base, options: ["Option 1", "Option 2"] }
          : type === "textarea"
            ? { ...base, placeholder: "Type notes here..." }
            : { ...base, body: "Information text for the team." };
    updateObjects([...normalizedTemplate.objects, object]);
  }

  function moveObject(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= normalizedTemplate.objects.length) return;
    const objects = [...normalizedTemplate.objects];
    const [item] = objects.splice(index, 1);
    objects.splice(nextIndex, 0, item);
    updateObjects(objects);
  }

  function removeObject(index) {
    if (normalizedTemplate.objects.length <= 1) return;
    updateObjects(normalizedTemplate.objects.filter((_, objectIndex) => objectIndex !== index));
  }

  return (
    <section className="safetyTemplateBuilder">
      <div className="safetyBuilderHeader">
        <div>
          <strong>Safety Form Builder</strong>
          <small>Create the exact PSI flow your crew will fill before work starts.</small>
        </div>
      </div>
      <div className="safetyBuilderAddGrid">
        {safetyTemplateObjectTypes.map((type) => (
          <button className="outlineButton" key={type.id} type="button" onClick={() => addObject(type.id)}>
            <Plus size={15} />
            {type.label}
          </button>
        ))}
      </div>
      <div className="safetyBuilderObjects">
        {normalizedTemplate.objects.map((object, index) => (
          <SafetyTemplateObjectEditor
            index={index}
            key={object.id}
            object={object}
            onMove={moveObject}
            onRemove={removeObject}
            onUpdate={(nextObject) => updateObject(index, nextObject)}
            total={normalizedTemplate.objects.length}
          />
        ))}
      </div>
    </section>
  );
}

function SafetyTemplateObjectEditor({ index, object, onMove, onRemove, onUpdate, total }) {
  function updateField(field, value) {
    onUpdate({ ...object, [field]: value });
  }

  function updateCheckboxItem(itemIndex, nextItem) {
    onUpdate({ ...object, items: object.items.map((item, index) => (index === itemIndex ? nextItem : item)) });
  }

  function addCheckboxItem() {
    if ((object.items ?? []).length >= safetyCheckboxLimit) return;
    onUpdate({ ...object, items: [...(object.items ?? []), { id: makeStableId("checkbox"), label: "New checkbox", details: false }] });
  }

  function removeCheckboxItem(itemIndex) {
    if ((object.items ?? []).length <= 1) return;
    onUpdate({ ...object, items: object.items.filter((_, index) => index !== itemIndex) });
  }

  function updateOption(optionIndex, value) {
    onUpdate({ ...object, options: object.options.map((option, index) => (index === optionIndex ? value : option)) });
  }

  function addOption() {
    onUpdate({ ...object, options: [...(object.options ?? []), `Option ${(object.options ?? []).length + 1}`] });
  }

  function removeOption(optionIndex) {
    if ((object.options ?? []).length <= 1) return;
    onUpdate({ ...object, options: object.options.filter((_, index) => index !== optionIndex) });
  }

  return (
    <article className="safetyBuilderObject">
      <div className="safetyBuilderObjectHeader">
        <div>
          <strong>{object.title || safetyTemplateObjectTypes.find((type) => type.id === object.type)?.label}</strong>
          <small>{safetyTemplateObjectTypes.find((type) => type.id === object.type)?.label}</small>
        </div>
        <div className="safetyBuilderObjectActions">
          <button className="iconButton soft" disabled={index === 0} type="button" onClick={() => onMove(index, -1)} title="Move up">
            <ChevronUp size={16} />
          </button>
          <button className="iconButton soft" disabled={index === total - 1} type="button" onClick={() => onMove(index, 1)} title="Move down">
            <ChevronDown size={16} />
          </button>
          <button className="iconButton danger" disabled={total <= 1} type="button" onClick={() => onRemove(index)} title="Remove block">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="safetyBuilderFields">
        <FormField label="Block title">
          <input value={object.title} onChange={(event) => updateField("title", event.target.value)} />
        </FormField>
        {object.type !== "text" && (
          <button className={`developerSwitch compactDeveloperSwitch ${object.required ? "checked" : ""}`} type="button" onClick={() => updateField("required", !object.required)}>
            <span>
              <strong>Required</strong>
              <small>User must complete this block before saving.</small>
            </span>
            <span className="developerSwitchControl">
              <span className="switchTrack" aria-hidden="true">
                <span />
              </span>
            </span>
          </button>
        )}
        {object.type === "text" && (
          <FormField label="Text shown to worker">
            <textarea value={object.body} onChange={(event) => updateField("body", event.target.value)} />
          </FormField>
        )}
        {object.type === "textarea" && (
          <FormField label="Placeholder">
            <input value={object.placeholder ?? ""} onChange={(event) => updateField("placeholder", event.target.value)} />
          </FormField>
        )}
      </div>
      {object.type === "checkboxes" && (
        <div className="safetyBuilderRows">
          {(object.items ?? []).map((item, itemIndex) => (
            <div className="safetyBuilderRow" key={item.id}>
              <input value={item.label} onChange={(event) => updateCheckboxItem(itemIndex, { ...item, label: event.target.value })} />
              <button className={`miniSwitchLine ${item.details ? "checked" : ""}`} type="button" onClick={() => updateCheckboxItem(itemIndex, { ...item, details: !item.details })}>
                <span className="switchTrack" aria-hidden="true">
                  <span />
                </span>
                Details field
              </button>
              <button className="iconButton soft" disabled={(object.items ?? []).length <= 1} type="button" onClick={() => removeCheckboxItem(itemIndex)} title="Remove checkbox">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button className="outlineButton" disabled={(object.items ?? []).length >= safetyCheckboxLimit} type="button" onClick={addCheckboxItem}>
            <Plus size={15} />
            Add checkbox
          </button>
        </div>
      )}
      {object.type === "select" && (
        <div className="safetyBuilderRows">
          {(object.options ?? []).map((option, optionIndex) => (
            <div className="safetyBuilderRow" key={`${object.id}-${optionIndex}`}>
              <input value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} />
              <button className="iconButton soft" disabled={(object.options ?? []).length <= 1} type="button" onClick={() => removeOption(optionIndex)} title="Remove option">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button className="outlineButton" type="button" onClick={addOption}>
            <Plus size={15} />
            Add option
          </button>
        </div>
      )}
    </article>
  );
}

function DeveloperSwitch({ checked, description, label, onChange }) {
  return (
    <button className={`developerSwitch ${checked ? "checked" : ""}`} type="button" onClick={() => onChange(!checked)}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <span className="developerSwitchControl">
        <span className="switchTrack" aria-hidden="true">
          <span />
        </span>
      </span>
    </button>
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

function GroupedPickerList({ groups = [], onToggle, selected = [], title }) {
  return (
    <fieldset className="pickerList groupedPickerList">
      <legend>{title}</legend>
      {groups.length === 0 && <span className="mutedLine">No records yet</span>}
      {groups.map((group) => (
        <div className="pickerTradeGroup" key={group.trade}>
          <div className="pickerTradeHeader">
            <strong>{group.trade}</strong>
            <em>{group.people.length}</em>
          </div>
          <div className="pickerTradeGrid">
            {group.people.map((item) => {
              const status = item.pickerStatus;
              return (
                <label className="pickerOption" key={item.id}>
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
                  <span className="switchTrack pickerSwitch" aria-hidden="true">
                    <span />
                  </span>
                  <span className="pickerOptionText">
                    <strong>{profileDisplayName(item)}</strong>
                    {status?.detail && <small>{status.detail}</small>}
                  </span>
                  {status && <em className={`resourceStatusChip ${status.tone}`}>{status.label}</em>}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function ProjectAddressEditor({ addresses = [], onAdd, onRemove, onUpdate }) {
  return (
    <fieldset className="projectAddressEditor">
      <legend>Project addresses</legend>
      {addresses.map((item, index) => (
        <div className="projectAddressRow" key={item.id || index}>
          <FormField label={index === 0 ? "Main address label" : "Address label"}>
            <input value={item.label} onChange={(event) => onUpdate(index, { label: event.target.value })} />
          </FormField>
          <FormField label={index === 0 ? "Main address" : "Address"}>
            <input required={index === 0} value={item.address} onChange={(event) => onUpdate(index, { address: event.target.value })} />
          </FormField>
          <button className="iconButton soft" type="button" disabled={addresses.length === 1} onClick={() => onRemove(index)} title="Remove address">
            <Trash2 size={17} />
          </button>
        </div>
      ))}
      <button className="outlineLink addAddressButton" type="button" onClick={onAdd}>
        <Plus size={16} />
        Add another address
      </button>
    </fieldset>
  );
}

function AppModal({ children, className = "", onClose, title, wide = false }) {
  const backdropPointerDownRef = useRef(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, left: 0 });
  }, [className, title, wide]);

  function handleBackdropPointerDown(event) {
    backdropPointerDownRef.current = event.target === event.currentTarget;
  }

  function handleBackdropPointerUp(event) {
    if (backdropPointerDownRef.current && event.target === event.currentTarget) onClose();
    backdropPointerDownRef.current = false;
  }

  return (
    <div className="modalBackdrop" onPointerDown={handleBackdropPointerDown} onPointerUp={handleBackdropPointerUp}>
      <div className={`${wide ? "modal wideModal" : "modal"} ${className}`.trim()}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton soft" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modalBody" ref={bodyRef}>
          {children}
        </div>
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

function PasswordRecoveryScreen({ form, loading = false, notice = "", onChange, onSubmit }) {
  return (
    <main className="authGate passwordRecoveryGate">
      <section className="authVisual" aria-hidden="true">
        <div className="authBrandCard">
          <div className="brandMark">B</div>
          <span>BuildCore Construction</span>
        </div>
        <div className="authPreview passwordResetPreview">
          <strong>Secure reset</strong>
          <p>Create a new password for your verified Supabase account.</p>
        </div>
      </section>

      <section className="authPanel" aria-label="Set new password">
        <div className="authCard passwordRecoveryCard">
          <div className="authLogo">
            <div className="brandMark">B</div>
            <div>
              <strong>BuildCore</strong>
              <span>Password recovery</span>
            </div>
          </div>
          <div className="authCopy">
            <h1>Set new password</h1>
            <p>Use a new password with at least 8 characters. After saving, your workspace will open automatically.</p>
          </div>
          {notice && <div className="authNotice">{notice}</div>}
          <PasswordChangeForm form={form} loading={loading} onChange={onChange} onSubmit={onSubmit} submitLabel="Save new password" />
        </div>
      </section>
    </main>
  );
}

function ForgotPasswordForm({ email = "", loading = false, onBack, onChange, onSubmit, step = "form" }) {
  if (step === "sent") {
    return (
      <div className="passwordResetPanel">
        <div className="passwordResetIcon">
          <Mail size={24} />
        </div>
        <h3>Check your email</h3>
        <p>If this email exists, reset instructions were sent. Open the link from the email, then create a new password.</p>
        <button className="outlineButton fullWidth" type="button" onClick={onBack}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form className="stackForm passwordResetPanel" onSubmit={onSubmit}>
      <div className="passwordResetIcon">
        <KeyRound size={24} />
      </div>
      <h3>Reset your password</h3>
      <p>Enter the email for your BuildCore account. For privacy, the app will not reveal whether this email exists.</p>
      <FormField label="Email">
        <input autoComplete="email" required type="email" value={email} onChange={(event) => onChange?.(event.target.value)} />
      </FormField>
      <button className="addButton fullWidth" type="submit" disabled={loading}>
        <Mail size={17} />
        {loading ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}

function AuthGate({
  authEmail = "",
  authAvatarEmoji = "",
  authFirstName = "",
  authLastName = "",
  authMode = "signin",
  authPassword = "",
  authPhone = "",
  forgotEmail = "",
  forgotStep = "form",
  loading = false,
  modalType = "",
  notice = "",
  onAvatarChange,
  onAvatarEmojiChange,
  onEmailChange,
  onFirstNameChange,
  onForgotBackToSignIn,
  onForgotClose,
  onForgotEmailChange,
  onForgotPassword,
  onForgotSubmit,
  onLastNameChange,
  onModeChange,
  onPasswordChange,
  onPhoneChange,
  onSubmit,
}) {
  const canSubmit = typeof onSubmit === "function";
  const isChecking = loading && !canSubmit;

  return (
    <>
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
                  <div className="authEmojiField">
                    <EmojiAvatarPicker label="Emoji avatar (optional)" selected={authAvatarEmoji} onSelect={onAvatarEmojiChange} />
                  </div>
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
              {authMode === "signin" && (
                <button className="forgotPasswordButton" type="button" onClick={onForgotPassword}>
                  Forgot password?
                </button>
              )}
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
      {modalType === "forgotPassword" && (
        <AppModal title={forgotStep === "sent" ? "Check your email" : "Reset password"} onClose={onForgotClose}>
          <ForgotPasswordForm email={forgotEmail} loading={loading} onBack={onForgotBackToSignIn} onChange={onForgotEmailChange} onSubmit={onForgotSubmit} step={forgotStep} />
        </AppModal>
      )}
    </>
  );
}

function ResourceGroup({ avatarUrls = {}, canDeleteTickets, dragPreview, peopleGroupDrag, setDragPreview, title, count, icon: Icon, rows, selectedDate, visits = [], onAssignEquipment, onAssignPerson, onAssignPeopleGroup, onCreateVisitFromDrop, onDropAssignment, onOpenPerson, onOpenProject, onRemoveVisit, onSelect }) {
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
              const scheduleBlockTarget = event.target instanceof Element ? event.target.closest(".scheduleBlock") : null;
              if (scheduleBlockTarget && event.currentTarget.contains(scheduleBlockTarget)) {
                setDragPreview?.(null);
                return;
              }
              event.preventDefault();
              const raw = event.dataTransfer.getData("application/json");
              const personId = event.dataTransfer.getData("application/x-buildcore-person");
              const hasPersonGroup = event.dataTransfer.types.includes("application/x-buildcore-person-group");
              if (!raw && !(row.kind === "project" && (personId || hasPersonGroup))) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
              const assignment = raw ? JSON.parse(raw) : null;
              const duration = Math.max(1, assignment ? assignment.end - assignment.start : 10);
              const rawStart = scheduleStartHour + percent * (scheduleEndHour - scheduleStartHour);
              const start = Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, Math.round(rawStart * 4) / 4));
              const end = start + duration;
              setDragPreview?.({
                rowId: row.id,
                left: ((start - scheduleStartHour) / (scheduleEndHour - scheduleStartHour)) * 100,
                width: ((end - start) / (scheduleEndHour - scheduleStartHour)) * 100,
                label: row.kind === "project" && !assignment && (personId || hasPersonGroup) ? `New ticket ${formatTimeRange(toTimeValue(start), toTimeValue(end))}` : formatTimeRange(toTimeValue(start), toTimeValue(end)),
              });
            }}
            onDrop={(event) => {
              const scheduleBlockTarget = event.target instanceof Element ? event.target.closest(".scheduleBlock") : null;
              if (scheduleBlockTarget && event.currentTarget.contains(scheduleBlockTarget)) {
                setDragPreview?.(null);
                return;
              }
              event.preventDefault();
              const raw = event.dataTransfer.getData("application/json");
              const personId = event.dataTransfer.getData("application/x-buildcore-person");
              const personGroupRaw = event.dataTransfer.getData("application/x-buildcore-person-group");
              const hasPersonGroup = Boolean(personGroupRaw);
              if (!raw && !(row.kind === "project" && (personId || hasPersonGroup))) return;
              setDragPreview?.(null);
              if (row.kind === "project" && (personId || hasPersonGroup)) {
                const group = personGroupRaw ? JSON.parse(personGroupRaw) : null;
                onCreateVisitFromDrop?.({
                  clientX: event.clientX,
                  groupLabel: group?.trade,
                  personId,
                  personIds: group?.personIds,
                  projectId: row.id,
                  trackElement: event.currentTarget,
                });
                return;
              }
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
                  title={`${profileDisplayName(person)} / ${person.trade || roleLabel(person.role)} / ${person.pickerStatus?.detail || "Available"}`}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData("application/x-buildcore-person", person.id);
                  }}
                  onClick={() => onOpenPerson?.(person)}
                >
                  <Avatar profile={person} url={avatarUrls[person.id]} />
                  <span>{profileDisplayName(person)}</span>
                  <small>{person.trade || roleLabel(person.role)}</small>
                  <span className="crewAvatarTooltip availableTooltip">
                    <strong>{profileDisplayName(person)}</strong>
                    <small>{person.trade || roleLabel(person.role)}</small>
                  </span>
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
            title={`${item.name} / ${item.unit_number || item.type || "Equipment"} / ${item.notes || item.status || "Available"}`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData("application/x-buildcore-equipment", item.id);
            }}
          >
            <EquipmentAvatar item={item} />
            <span>{item.name}</span>
            <small>{item.unit_number || item.type}</small>
            <span className="crewAvatarTooltip availableTooltip">
              <strong>{item.name}</strong>
              <small>{item.unit_number || item.type || "Equipment"}</small>
            </span>
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
  const typeLabel = assignment.recordType === "siteVisit" ? "Inspection" : "Work Ticket";
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
      className={`scheduleBlock ${assignment.recordType ?? "visit"} ${assignment.color} ${assignment.status ?? ""} ${dropHint ? "showDropHint" : ""} ${isShortBlock ? "shortBlock" : ""} ${isTightBlock ? "tightBlock" : ""}`}
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
        if (!assignment.visitId) return;
        if (
          event.dataTransfer.types.includes("application/x-buildcore-person") ||
          event.dataTransfer.types.includes("application/x-buildcore-person-group") ||
          event.dataTransfer.types.includes("application/x-buildcore-assigned-person") ||
          event.dataTransfer.types.includes("application/x-buildcore-equipment") ||
          event.dataTransfer.types.includes("application/x-buildcore-assigned-equipment")
        ) {
          event.preventDefault();
          event.stopPropagation();
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
        if (!assignment.visitId) return;
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
        <em className="scheduleBlockType">{typeLabel}</em>
        {assignment.status && <em className="scheduleBlockStatus">{assignment.recordType === "siteVisit" && assignment.status === "completed" ? "Done" : normalizeVisitStatus(assignment.status)}</em>}
      </span>
      {assignment.timeText && <small className="scheduleBlockTime">{assignment.timeText}</small>}
      {(assignment.people?.length > 0 || assignment.equipment?.length > 0) && (
        <div className="assignmentResources">
          {assignment.people?.map((person) => (
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
                <span className="crewAvatarTooltip">
                  <strong>{profileDisplayName(person)}</strong>
                  <small>{person.trade || roleLabel(person.role)}</small>
                </span>
              </button>
          ))}
          {assignment.equipment?.map((item) => (
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
                <span className="crewAvatarTooltip">
                  <strong>{item.name}</strong>
                  <small>{item.unit_number || item.type || "Equipment"}</small>
                </span>
              </button>
          ))}
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

function PhotoViewer({ attachment, canDelete, dictation, dictationBusy = false, isAnnotating, items = [], loading, onAnnotate, onCancelAnnotate, onDelete, onDownload, onSaveAnnotation, onSaveCaption, onSelect, onZoom, profiles = [], zoom }) {
  const [captionDraft, setCaptionDraft] = useState(attachment.photo_caption || "");
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const uploader = profiles.find((person) => person.id === attachment.uploaded_by);
  const history = Array.isArray(attachment.annotation_history) ? attachment.annotation_history : [];
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === attachment.id));
  const hasMultiplePhotos = items.length > 1;
  const previousPhoto = hasMultiplePhotos ? items[(currentIndex - 1 + items.length) % items.length] : null;
  const nextPhoto = hasMultiplePhotos ? items[(currentIndex + 1) % items.length] : null;

  useEffect(() => {
    setCaptionDraft(attachment.photo_caption || "");
    setIsEditingCaption(false);
  }, [attachment.id, attachment.photo_caption]);

  if (isAnnotating) {
    return (
      <div className="photoAnnotatorPanel">
        <div className="viewerTopBar">
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
          {isEditingCaption ? (
            <div className="photoCaptionEditor">
              <VoiceTextArea dictation={dictation} value={captionDraft} onChange={setCaptionDraft} placeholder="Add a clear note for this photo..." rows={3} />
              <span>
                <button className="outlineButton" type="button" onClick={() => setIsEditingCaption(false)}>
                  Cancel
                </button>
                <button
                  className="addButton"
                  type="button"
                  disabled={loading || dictationBusy}
                  onClick={async () => {
                    await onSaveCaption?.(attachment, captionDraft);
                    setIsEditingCaption(false);
                  }}
                >
                  Save note
                </button>
              </span>
            </div>
          ) : (
            <div className="photoCaptionLine">
              <p className={attachment.photo_caption ? "photoCaption" : "photoCaption empty"}>{attachment.photo_caption || "No photo note yet."}</p>
              {!attachment.localPreview && (
                <button className="captionEditButton" type="button" onClick={() => setIsEditingCaption(true)}>
                  <Edit3 size={14} />
                  {attachment.photo_caption ? "Edit note" : "Add note"}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="viewerControls viewerControlGrid">
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
        <div className="viewerControls viewerControlGrid">
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

function PdfCanvasViewer({ fileName, url }) {
  const [error, setError] = useState("");
  const [pageNumbers, setPageNumbers] = useState([]);
  const [pdf, setPdf] = useState(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let alive = true;
    setError("");
    setPdf(null);
    setPageNumbers([]);

    loadPdfDocumentFromUrl(url)
      .then((document) => {
        if (!alive) return;
        setPdf(document);
        setPageNumbers(Array.from({ length: document.numPages }, (_, index) => index + 1));
      })
      .catch((loadError) => {
        if (alive) setError(loadError.message || "PDF could not be opened.");
      });

    return () => {
      alive = false;
    };
  }, [url]);

  function preventPageZoom(event) {
    if (event.touches?.length > 1) event.preventDefault();
  }

  function changeScale(delta) {
    setScale((value) => Math.min(1.9, Math.max(0.7, Number((value + delta).toFixed(2)))));
  }

  return (
    <div className="pdfCanvasViewer" onTouchStart={preventPageZoom} onTouchMove={preventPageZoom}>
      <div className="pdfCanvasControls">
        <span>{pageNumbers.length ? `${pageNumbers.length} page${pageNumbers.length === 1 ? "" : "s"}` : "Loading PDF..."}</span>
        <button type="button" title="Zoom out" onPointerDown={(event) => event.stopPropagation()} onClick={() => changeScale(-0.15)}>
          <ZoomOut size={16} />
        </button>
        <strong>{Math.round(scale * 100)}%</strong>
        <button type="button" title="Zoom in" onPointerDown={(event) => event.stopPropagation()} onClick={() => changeScale(0.15)}>
          <ZoomIn size={16} />
        </button>
      </div>
      {error ? (
        <div className="emptyPanelState">{error}</div>
      ) : pdf ? (
        <div className="pdfPageStack" aria-label={fileName}>
          {pageNumbers.map((pageNumber) => (
            <PdfPageCanvas key={pageNumber} pageNumber={pageNumber} pdf={pdf} scale={scale} />
          ))}
        </div>
      ) : (
        <div className="pdfPageSkeleton" />
      )}
    </div>
  );
}

function PdfPageCanvas({ pageNumber, pdf, scale }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function renderPage() {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvasRef.current) return;
      const safeScale = Math.max(0.7, scale);
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const canvas = canvasRef.current;
      const viewer = canvas.closest(".pdfCanvasViewer");
      const pageViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(260, (viewer?.clientWidth || 760) - 24);
      const fitScale = Math.min(1, availableWidth / pageViewport.width);
      const cssViewport = page.getViewport({ scale: fitScale * safeScale });
      const renderViewport = page.getViewport({ scale: fitScale * safeScale * pixelRatio });
      const context = canvas.getContext("2d");
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);
      canvas.style.width = `${Math.round(cssViewport.width)}px`;
      canvas.style.height = "auto";
      canvas.style.aspectRatio = `${renderViewport.width} / ${renderViewport.height}`;
      renderTask = page.render({ canvasContext: context, viewport: renderViewport });
      await renderTask.promise;
    }

    renderPage().catch(() => {
      if (!cancelled && canvasRef.current) canvasRef.current.dataset.error = "true";
    });

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pageNumber, pdf, scale]);

  return (
    <figure className="pdfPageCanvasWrap">
      <canvas ref={canvasRef} />
      <figcaption>Page {pageNumber}</figcaption>
    </figure>
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
