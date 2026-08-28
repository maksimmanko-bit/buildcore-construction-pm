import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Download,
  Edit3,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
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
  CloudSun,
  Trash2,
  Truck,
  Upload,
  UserPlus,
  UserRound,
  UsersRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { jsPDF } from "jspdf";
import DocumentUploader from "./components/DocumentUploader.jsx";
import PhotoAnnotator from "./components/PhotoAnnotator.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { createAttachmentUrls, createProfileAvatarUrl, deleteVisitFile, replaceVisitPhotoWithAnnotation, uploadProfileAvatar, uploadVisitGeneratedFile, uploadVisitPhoto } from "./lib/storage.js";
import { localGlobalSearch } from "./lib/search.js";
import { getGoogleMapsUrl, getWeatherForAddress } from "./lib/weather.js";

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
    { id: "person-1", full_name: "Alex Johnson", role: "builder", trade: "Site Supervisor", phone: "(204) 555-0101", avatar: "AJ" },
    { id: "person-2", full_name: "Michael Smith", role: "builder", trade: "Carpenter", phone: "(204) 555-0102", avatar: "MS" },
    { id: "person-3", full_name: "David Brown", role: "builder", trade: "Electrician", phone: "(204) 555-0103", avatar: "DB" },
    { id: "person-4", full_name: "James Wilson", role: "builder", trade: "Plumber", phone: "(204) 555-0104", avatar: "JW" },
    { id: "person-5", full_name: "Robert Taylor", role: "builder", trade: "Operator", phone: "(204) 555-0105", avatar: "RT" },
  ],
  equipment: [
    { id: "eq-1", name: "Excavator 320", type: "Excavator", unit_number: "EX-320", icon: "excavator" },
    { id: "eq-2", name: "Skid Steer S770", type: "Skid Steer", unit_number: "SS-770", icon: "loader" },
    { id: "eq-3", name: "Pickup Truck #12", type: "Truck", unit_number: "TR-12", icon: "truck" },
    { id: "eq-4", name: "Boom Lift 45ft", type: "Lift", unit_number: "BL-45", icon: "lift" },
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
const emptyEquipmentForm = { name: "", type: "", unit_number: "", notes: "" };
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

function equipmentIcon(type) {
  const label = String(type ?? "").toLowerCase();
  if (label.includes("truck") || label.includes("pickup")) return "TR";
  if (label.includes("lift")) return "LF";
  if (label.includes("skid")) return "SS";
  if (label.includes("trailer")) return "TL";
  return "EX";
}

function toHour(time) {
  const [hours, minutes] = String(time ?? "08:00").split(":").map(Number);
  return hours + (minutes || 0) / 60;
}

function toTimeValue(hourValue) {
  const clamped = Math.max(0, Math.min(23.75, hourValue));
  const totalMinutes = Math.round(clamped * 4) * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

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
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="formField dateField">
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

export default function App() {
  const globalSearchRef = useRef(null);
  const searchInputRef = useRef(null);
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
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [companyForm, setCompanyForm] = useState({ company_name: "BuildCore Construction", full_name: "", phone: "" });
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [visitForm, setVisitForm] = useState(emptyVisitForm);
  const [safetyForm, setSafetyForm] = useState({ hazards: [], notes: "", signatures: {} });
  const [workflowVisitId, setWorkflowVisitId] = useState("");
  const [photoStep, setPhotoStep] = useState({ kind: "", visitId: "", files: [], captions: {} });
  const [completionForm, setCompletionForm] = useState({ notes: "", files: [], captions: {} });
  const [profileForm, setProfileForm] = useState({ first_name: "", last_name: "", phone: "", avatarFile: null, removeAvatar: false });
  const [personForm, setPersonForm] = useState({ first_name: "", last_name: "", phone: "", role: "builder", trade: "", availability_status: "available" });
  const [avatarUrls, setAvatarUrls] = useState({});

  const isLive = Boolean(session && profile?.is_active);
  const canManage = Boolean(profile?.is_active && ["owner", "project_manager", "office_manager"].includes(profile?.role));
  const canDeleteTickets = Boolean(profile?.is_active && profile?.role !== "builder");
  const visibleNavItems = canManage ? navItems : navItems.filter((item) => !["people", "equipment"].includes(item.id));
  const currentUserName = profile?.full_name || session?.user?.email || "James Carter";

  const refreshData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setNotice("");

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

      const nextCanManage = ["owner", "project_manager", "office_manager"].includes(nextProfile.role);
      const peopleQuery = nextCanManage
        ? supabase.from("profiles").select("*").order("is_active", { ascending: true }).order("full_name")
        : supabase.from("profiles").select("*").eq("is_active", true).order("full_name");

      const [projectsResult, peopleResult, equipmentResult, visitsResult, filesResult, activityResult] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        peopleQuery,
        supabase.from("equipment").select("*").order("name"),
        supabase.from("visit_schedule_view").select("*").order("visit_date", { ascending: false }).order("start_time"),
        supabase.from("visit_files").select("*").order("created_at", { ascending: false }),
        supabase.from("visit_activity").select("*").order("created_at", { ascending: false }).limit(500),
      ]);

      const failed = [projectsResult, peopleResult, equipmentResult, visitsResult, filesResult, activityResult].find((result) => result.error);
      if (failed) throw failed.error;

      const nextProjects = projectsResult.data ?? [];
      const allPeople = peopleResult.data ?? [];
      setData({
        companyId: nextProfile.company_id,
        projects: nextProjects,
        people: allPeople.filter((person) => person.is_active),
        pendingPeople: allPeople.filter((person) => !person.is_active),
        equipment: equipmentResult.data ?? [],
        visits: visitsResult.data ?? [],
        files: filesResult.data ?? [],
        activities: activityResult.data ?? [],
      });

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
  }, [activeNav, canManage]);

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
        timeText: `${String(visit.start_time).slice(0, 5)} - ${String(visit.end_time).slice(0, 5)}`,
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
    const locked = isSearchOpen || Boolean(detailOverlay) || Boolean(modalType) || Boolean(selectedAttachment) || isMobileMenuOpen;
    document.body.classList.toggle("overlayLocked", locked);
    return () => document.body.classList.remove("overlayLocked");
  }, [detailOverlay, isMobileMenuOpen, isSearchOpen, modalType, selectedAttachment]);

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
  const todayVisits = (rowsSource.visits ?? []).filter((visit) => visit.visit_date === todayValue && (!isLive || visit.people_ids?.includes(profile?.id)));
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
      const projectVisits = (rowsSource.visits ?? []).filter((visit) => visit.project_id === project.id && visit.visit_date === selectedDate && visit.status !== "cancelled");
      return {
        ...project,
        kind: "project",
        full_name: project.name,
        subtitle: project.job_number || project.address,
        color: colors[index % colors.length],
        assignments: projectVisits.map((visit, visitIndex) => ({
          visitId: visit.id,
          projectId: visit.project_id,
          title: project.name,
          subtitle: visit.work_scope || normalizeVisitStatus(visit.status),
          start: toHour(visit.start_time),
          end: toHour(visit.end_time),
          timeText: `${String(visit.start_time).slice(0, 5)} - ${String(visit.end_time).slice(0, 5)}`,
          status: visit.status,
          isFirstVisit: visit.is_first_visit,
          color: colors[index % colors.length],
          people: rowsSource.people.filter((person) => visit.people_ids?.includes(person.id)),
          equipment: rowsSource.equipment.filter((item) => visit.equipment_ids?.includes(item.id)),
          laneIndex: visitIndex,
          laneCount: projectVisits.length,
        })),
      };
    })
    .filter((project) => project.assignments.length > 0);
  const availableTodayPeople = rowsSource.people.filter((person) => getPersonWorkStatus({ date: selectedDate, person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }).tone === "available");
  const visitPickerPeople = rowsSource.people.map((person) => ({
    ...person,
    pickerStatus: getPersonWorkStatus({ date: visitForm.visit_date, person, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
  }));
  const visitPickerEquipment = rowsSource.equipment.map((equipment) => ({
    ...equipment,
    pickerStatus: getEquipmentWorkStatus({ date: visitForm.visit_date, equipment, projects: rowsSource.projects, visits: rowsSource.visits ?? [] }),
  }));
  const visitFormDates = editingVisitId ? [visitForm.visit_date] : collectBusinessDates(visitForm.visit_date, Math.max(1, parseWorkDayCount(visitForm.duration_days)));
  const visitWorkScopes = normalizeWorkScopes(visitForm.work_scopes, visitFormDates.length, visitForm.work_scope);

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

    setProjectForm(emptyProjectForm);
    setEditingProjectId(null);
    setModalType(null);
    setSelectedProjectId(saved.id);
    setNotice(editingProjectId ? "Project changes saved." : "Project saved.");
    refreshData();
  }

  function editProject(project) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can edit projects.");
      return;
    }

    setEditingProjectId(project.id);
    setProjectForm({
      job_number: project.job_number ?? "",
      name: project.name ?? "",
      address: project.address ?? "",
      manager_id: project.manager_id ?? project.created_by ?? profile?.id ?? "",
      contact_name: project.contact_name ?? "",
      contact_email: project.contact_email ?? "",
      contact_phone: project.contact_phone ?? "",
      description: project.description ?? "",
      status: project.status && projectStatusMap[project.status] ? project.status : "planning",
    });
    setModalType("project");
  }

  async function deleteProject(project) {
    if (!supabase || !canManage) {
      setNotice("Sign in as Owner, PM, or Office Manager to delete projects.");
      return;
    }

    const confirmed = window.confirm(`Delete project "${project.name}" and its scheduled visits?`);
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice("Project deleted.");
    setSelectedProjectId("");
    setSelectedVisitId("");
    refreshData();
  }

  async function saveEquipment(event) {
    event.preventDefault();
    if (!supabase || !profile) return;

    setLoading(true);
    const { error } = await supabase.from("equipment").insert({
      ...equipmentForm,
      company_id: profile.company_id,
    });
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setEquipmentForm(emptyEquipmentForm);
    setModalType(null);
    setNotice("Equipment saved.");
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
    const generatedDates = editingVisitId ? [visitForm.visit_date] : collectBusinessDates(visitForm.visit_date, requestedWorkDays);
    const workScopes = normalizeWorkScopes(visitForm.work_scopes, generatedDates.length, visitForm.work_scope).map((scope) => scope.trim());

    if (workScopes.some((scope) => !scope)) {
      setLoading(false);
      setNotice("Add a Work Scope for every scheduled work day.");
      return;
    }

    try {
      let firstVisit = null;

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
      setVisitForm({ ...emptyVisitForm, visit_date: selectedDate, project_id: rowsSource.projects[0]?.id ?? "" });
      setEditingVisitId(null);
      setModalType(null);
      setSelectedDate(firstVisit.visit_date);
      setSelectedProjectId(firstVisit.project_id);
      setSelectedVisitId(firstVisit.id);
      setNotice(editingVisitId ? "Visit changes saved." : `${generatedDates.length} visit${generatedDates.length === 1 ? "" : "s"} scheduled. Weekends skipped.`);
      refreshData();
    } catch (error) {
      if (!editingVisitId && createdVisitIds.length > 0) await supabase.from("visits").delete().in("id", createdVisitIds);
      setLoading(false);
      setNotice(error.message);
      refreshData();
    }
  }

  async function updateRole(person, role) {
    if (!supabase || !canManage) return;

    const { error } = await supabase.from("profiles").update({ role }).eq("id", person.id);
    if (error) {
      setNotice(error.message);
      return;
    }

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

    setNotice(`${profileDisplayName(person, "Employee")} approved as ${roleLabel(role)}.`);
    refreshData();
  }

  function editPerson(person) {
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

    setNotice("Employee profile saved.");
    setModalType(null);
    refreshData();
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
    setNotice("Generating Safety PDF...");
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
      setNotice("Profile saved.");
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
    refreshData();
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

    refreshData();
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

  function startArrivalWorkflow(visit = currentVisit) {
    if (!visit?.id) {
      setNotice("Select today's visit first.");
      return;
    }

    const files = getVisitFiles(visit);
    const hasSafety = files.some((file) => file.file_type === "safety_form");
    const hasBefore = files.some((file) => file.file_type === "before_photo");

    setWorkflowVisitId(visit.id);
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);

    if (!hasSafety) {
      const team = rowsSource.people.filter((person) => visit.people_ids?.includes(person.id));
      setSafetyForm({
        hazards: [],
        notes: "",
        signatures: Object.fromEntries(team.map((person) => [person.id, ""])),
      });
      setModalType("safety");
      return;
    }

    if (!hasBefore) {
      setPhotoStep({ kind: "before", visitId: visit.id, files: [], captions: {} });
      setModalType("beforePhotos");
      return;
    }

    updateVisitStatusById(visit.id, "on_site");
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

    const team = rowsSource.people.filter((person) => activeVisit.people_ids?.includes(person.id));
    const missingSignature = team.some((person) => !safetyForm.signatures[person.id]?.trim());
    if (safetyForm.hazards.length === 0 || missingSignature) {
      setNotice("Select hazards and collect every team member signature before continuing.");
      return;
    }

    setLoading(true);
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
      doc.text(doc.splitTextToSize(`Address: ${activeProject.address}`, 492), 42, 170);
      doc.text(`Visit Date: ${formatDateLabel(activeVisit.visit_date)}`, 42, 196);
      doc.text(`Current Time: ${signedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, 220, 196);
      doc.text(`Scheduled Time: ${String(activeVisit.start_time).slice(0, 5)} - ${String(activeVisit.end_time).slice(0, 5)}`, 398, 196);

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
      team.forEach((person) => {
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(42, y, 528, 82, 8, 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(person.full_name || person.email || "Team member", 58, y + 24);
        doc.setFont("helvetica", "normal");
        doc.text(`Signed: ${signedAt.toLocaleString()}`, 58, y + 42);
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
        signedAt.toLocaleString(),
        safetyForm.hazards.join(", "),
        safetyForm.notes,
        ...names,
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
      });
      setWorkflowVisitId(activeVisit.id);
      setPhotoStep({ kind: "before", visitId: activeVisit.id, files: [], captions: {} });
      setModalType("beforePhotos");
      setNotice("Safety form saved. Add before photos to start work.");
      refreshData();
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
      await Promise.all(
        photoStep.files.map((file) => {
          const caption = photoStep.captions?.[fileInputKey(file)]?.trim() || "";
          return uploadVisitPhoto({
          companyId: rowsSource.companyId,
          projectId: activeProject.id,
          visitId: activeVisit.id,
          profileId: profile.id,
          file,
          fileType: "before_photo",
          photoCaption: caption,
          searchText: `Before photo uploaded by ${currentUserName} at ${new Date().toISOString()}. ${caption}`,
          });
        }),
      );
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
      setNotice("Work started. Ticket is Active.");
      refreshData();
    } catch (error) {
      setNotice(error.message);
    } finally {
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
    if (completionForm.files.length === 0) {
      setNotice("Upload at least one after photo before completing work.");
      return;
    }

    setLoading(true);
    try {
      setNotice(`Uploading ${completionForm.files.length} after photo${completionForm.files.length === 1 ? "" : "s"}...`);
      await Promise.all(
        completionForm.files.map((file) => {
          const caption = completionForm.captions?.[fileInputKey(file)]?.trim() || "";
          return uploadVisitPhoto({
          companyId: rowsSource.companyId,
          projectId: activeProject.id,
          visitId: activeVisit.id,
          profileId: profile.id,
          file,
          fileType: "completion_photo",
          photoCaption: caption,
          searchText: `After photo uploaded by ${currentUserName} at ${new Date().toISOString()}. ${completionForm.notes} ${caption}`,
          });
        }),
      );
      await logVisitActivity(activeVisit, "after_photos_uploaded", `${currentUserName} uploaded ${completionForm.files.length} after photo${completionForm.files.length === 1 ? "" : "s"}.`, {
        count: completionForm.files.length,
      });
      await updateVisitStatusById(activeVisit.id, "completed", { completion_notes: completionForm.notes });
      await logVisitActivity(activeVisit, "completed", `${currentUserName} completed the visit.`, {
        completedAt: new Date().toISOString(),
        notes: completionForm.notes,
      });
      setModalType(null);
      setWorkflowVisitId("");
      setCompletionForm({ notes: "", files: [], captions: {} });
      setNotice("Thank you. Work is Done.");
      refreshData();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteVisit(visitToDelete = currentVisit) {
    if (!supabase || !visitToDelete?.id || !canDeleteTickets) {
      setNotice("Select a live visit and sign in with a non-Builder role.");
      return;
    }

    const project = rowsSource.projects.find((item) => item.id === visitToDelete.project_id) ?? selectedProject;
    const confirmed = window.confirm(`Remove ticket for "${project?.name ?? "Project"}" on ${formatDateLabel(visitToDelete.visit_date)}?\n\nThis will also remove its Activity Feed history.`);
    if (!confirmed) return;

    const { error } = await supabase.from("visits").delete().eq("id", visitToDelete.id);
    if (error) {
      setNotice(error.message);
      return;
    }

    setSelectedAssignmentId("");
    if (selectedVisitId === visitToDelete.id) setSelectedVisitId("");
    if (workflowVisitId === visitToDelete.id) setWorkflowVisitId("");
    if (photoStep.visitId === visitToDelete.id) setPhotoStep({ kind: "", visitId: "", files: [], captions: {} });
    if (detailOverlay === "visit") closeDetailOverlay();
    setNotice("Ticket and Activity Feed removed.");
    refreshData();
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
    setData((current) => ({
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
          setData(previousData);
          setLoading(false);
          setNotice(addResult.error.message);
          refreshData();
          return;
        }
        addedNewResource = true;
      } else {
        const addResult = await supabase.from("visit_equipment").insert({ visit_id: assignment.visitId, equipment_id: row.id });
        if (addResult.error) {
          setData(previousData);
          setLoading(false);
          setNotice(addResult.error.message);
          refreshData();
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
      setData(previousData);
      if (addedNewResource) {
        if (row.kind === "person") await supabase.from("visit_people").delete().eq("visit_id", assignment.visitId).eq("profile_id", row.id);
        else await supabase.from("visit_equipment").delete().eq("visit_id", assignment.visitId).eq("equipment_id", row.id);
      }
      setLoading(false);
      setNotice(visitResult.error.message);
      refreshData();
      return;
    }

    if (addedNewResource) {
      const removeResult =
        row.kind === "person"
          ? await supabase.from("visit_people").delete().eq("visit_id", assignment.visitId).eq("profile_id", assignment.resourceId)
          : await supabase.from("visit_equipment").delete().eq("visit_id", assignment.visitId).eq("equipment_id", assignment.resourceId);

      if (removeResult.error) {
        setData(previousData);
        setLoading(false);
        setNotice(removeResult.error.message);
        refreshData();
        return;
      }
    }

    setLoading(false);
    setNotice(`Visit moved to ${nextStartTime} - ${nextEndTime}.`);
    refreshData();
  }

  async function assignPersonToVisit({ personId, visitId }) {
    if (!supabase || !canManage) {
      setNotice("Only Owner, PM, or Office Manager can assign people.");
      return;
    }
    if (!personId || !visitId) return;

    const visit = (rowsSource.visits ?? []).find((item) => item.id === visitId);
    const person = rowsSource.people.find((item) => item.id === personId);
    if (!visit || !person) return;
    if (visit.people_ids?.includes(personId)) {
      setNotice(`${profileDisplayName(person)} is already assigned to this ticket.`);
      return;
    }

    const previousData = data;
    setData((current) => ({
      ...current,
      visits: (current.visits ?? []).map((item) => {
        if (item.id !== visitId) return item;
        const peopleIds = new Set(item.people_ids ?? []);
        peopleIds.add(personId);
        return { ...item, people_ids: [...peopleIds] };
      }),
    }));
    setNotice(`Assigning ${profileDisplayName(person)}...`);
    setLoading(true);
    try {
      const { error } = await supabase.from("visit_people").insert({ visit_id: visitId, profile_id: personId });
      if (error) throw error;
      await logVisitActivity(visit, "person_assigned", `${currentUserName} assigned ${profileDisplayName(person)} to this ticket.`, { personId });
      setNotice(`${profileDisplayName(person)} assigned to ticket.`);
      refreshData();
    } catch (error) {
      setData(previousData);
      setNotice(error.message);
      refreshData();
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

    const previousData = data;
    setData((current) => ({
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
      setNotice(`${profileDisplayName(person)} removed from ticket.`);
      refreshData();
    } catch (error) {
      setData(previousData);
      setNotice(error.message);
      refreshData();
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
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
      setEditingProjectId(null);
      setProjectForm({ ...emptyProjectForm, manager_id: profile.id });
      setModalType("project");
    } else if (activeNav === "equipment") setModalType("equipment");
    else if (activeNav === "people") setModalType("people");
    else {
      setEditingVisitId(null);
      setVisitForm({
        ...emptyVisitForm,
        visit_date: selectedDate,
        project_id: selectedProject?.id ?? rowsSource.projects[0]?.id ?? "",
      });
      setModalType("visit");
    }
  }

  function openVisitModal(projectId = selectedProject?.id) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can schedule visits.");
      return;
    }

    setEditingVisitId(null);
    setVisitForm({
      ...emptyVisitForm,
      visit_date: selectedDate,
      project_id: projectId ?? "",
    });
    setModalType("visit");
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

  function editVisit(visit) {
    if (!canManage) {
      setNotice("Only Owner, PM, or Office Manager can edit visits.");
      return;
    }

    setEditingVisitId(visit.id);
    setVisitForm({
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
    });
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
      const visit = (rowsSource.visits ?? []).find((item) => item.id === saved.visit_id);
      await logVisitActivity(visit, "photo_annotated", `${currentUserName} annotated ${saved.file_name}.`, { fileId: saved.id });
      await refreshData();
      setIsAnnotatingPhoto(false);
      setNotice("Annotation saved and original photo replaced.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeSelectedAttachment() {
    if (!selectedAttachment) return;
    const confirmed = window.confirm(`Delete "${selectedAttachment.file_name || "photo"}"?`);
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
      await refreshData();
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
      const nextDates = editingVisitId ? [value] : collectBusinessDates(value, nextDuration);
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
      const nextDates = collectBusinessDates(current.visit_date, Math.max(1, durationDays));
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
      const dates = editingVisitId ? [current.visit_date] : collectBusinessDates(current.visit_date, durationDays);
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
          <SectionToolbar label="Projects" onAdd={openAddModal} />
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
          <EquipmentView equipment={rowsSource.equipment} />
        </>
      );
    }
    if (activeNav === "documents") {
      return <DocumentsView files={rowsSource.files ?? []} onOpen={openAttachment} profiles={rowsSource.people} projects={rowsSource.projects} />;
    }
    if (activeNav === "safetyReports") {
      return <SafetyReportsView files={rowsSource.files ?? []} onOpen={openAttachment} profiles={rowsSource.people} projects={rowsSource.projects} />;
    }
    if (activeNav === "settings") {
      return <SettingsView avatarUrl={avatarUrls[profile?.id]} form={profileForm} isConfigured={isSupabaseConfigured} loading={loading} onChange={setProfileForm} onSubmit={saveProfileSettings} profile={profile} session={session} />;
    }
    if (activeNav === "overview") {
      return <OverviewView data={rowsSource} getProfileName={getProfileName} getVisitFiles={getVisitFiles} onArrive={startArrivalWorkflow} onComplete={startCompletionWorkflow} onOpenVisit={openVisitOverlay} profile={profile} projects={rowsSource.projects} todayVisits={todayVisits} />;
    }
    return (
      <ScheduleView
        assignmentsReady={assignmentsSource.length > 0}
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
        onAssignPerson={assignPersonToVisit}
        onDropAssignment={moveVisitAssignment}
        onOpenPerson={openPersonOverlay}
        onOpenProject={selectProject}
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
    <div className={isMobileMenuOpen ? "dashboardShell mobileMenuOpen" : "dashboardShell"}>
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
          <button className="sideNavItem drawerOnly" type="button" onClick={signOut}>
            <LogOut size={20} />
            <span>Sign out</span>
          </button>
        </nav>

        <div className="sidebarUser">
          <Avatar profile={profile} url={avatarUrls[profile?.id]} />
          <div>
            <strong>{currentUserName}</strong>
            <span>{profile ? roleLabel(profile.role) : "Project Manager"}</span>
          </div>
          <ChevronDown size={18} />
        </div>
      </aside>

      <main className="mainWorkspace">
        {(loading || notice) && (
          <div className={loading ? "noticeToast isLoading" : "noticeToast"}>
            {loading && <span />}
            <strong>{loading ? notice || "Saving changes..." : notice}</strong>
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
          <Avatar profile={profile} small url={avatarUrls[profile?.id]} />
        </div>
        <header className="workspaceHeader">
          <div>
            <h1>{activeNav === "schedule" ? "Schedule" : navItems.find((item) => item.id === activeNav)?.label}</h1>
            {notice && <p className="headerNotice">{notice}</p>}
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

            <Avatar profile={profile} small url={avatarUrls[profile?.id]} />
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
                            {String(visit.start_time).slice(0, 5)} - {String(visit.end_time).slice(0, 5)} · {normalizeStatus(visit.status)}
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
              <DocumentUploader
                attachments={projectAttachments}
                companyId={rowsSource.companyId}
                profileId={profile?.id}
                projectId={selectedProject.id}
                visitId={null}
                onOpen={openAttachment}
                onUploaded={(message) => {
                  setNotice(message);
                  refreshData();
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
                ) : searchResults.length > 0 ? (
                  searchResults.map((result) => (
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
            files={projectAttachments}
            getProfileName={getProfileName}
            onAddVisit={() => openVisitModal(selectedProject.id)}
            onClose={closeDetailOverlay}
            onEditProject={() => editProject(selectedProject)}
            onEditVisit={editVisit}
            onOpenAttachment={openAttachment}
            onOpenVisit={openVisitOverlay}
            onRemoveVisit={deleteVisit}
            onUploaded={(message) => {
              setNotice(message);
              refreshData();
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
            files={currentVisitFiles}
            getProfileName={getProfileName}
            onArrive={() => startArrivalWorkflow(currentVisit)}
            onClose={closeDetailOverlay}
            onComplete={() => startCompletionWorkflow(currentVisit)}
            onEdit={() => editVisit(currentVisit)}
            onOpenAttachment={openAttachment}
            onUploaded={(message) => {
              setNotice(message);
              refreshData();
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
            canManage={canManage}
            onEdit={() => editPerson(selectedPerson)}
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
          <AppModal title={editingProjectId ? "Edit project" : "Add project"} onClose={() => setModalType(null)}>
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
          <AppModal title="Add equipment" onClose={() => setModalType(null)}>
            <form className="stackForm" onSubmit={saveEquipment}>
              <FormField label="Name">
                <input required value={equipmentForm.name} onChange={(event) => setEquipmentForm({ ...equipmentForm, name: event.target.value })} />
              </FormField>
              <FormField label="Type">
                <input required placeholder="Trailer, Excavator, Pickup..." value={equipmentForm.type} onChange={(event) => setEquipmentForm({ ...equipmentForm, type: event.target.value })} />
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
          <AppModal title={editingVisitId ? "Edit visit" : "Schedule visit"} onClose={() => setModalType(null)}>
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
                <input required type="time" value={visitForm.start_time} onChange={(event) => setVisitForm({ ...visitForm, start_time: event.target.value })} />
              </FormField>
              <FormField label="End time">
                <input required type="time" value={visitForm.end_time} onChange={(event) => setVisitForm({ ...visitForm, end_time: event.target.value })} />
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
          <AppModal title="Digital Safety Form" onClose={() => setModalType(null)} wide>
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
          <AppModal title="Before Work Photos" onClose={() => setModalType(null)}>
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
          <AppModal title="Complete Work" onClose={() => setModalType(null)}>
            <CompleteVisitModal form={completionForm} loading={loading} onChange={setCompletionForm} onSubmit={saveCompletion} />
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
                <input placeholder="Carpenter, Operator, Electrician..." value={personForm.trade} onChange={(event) => setPersonForm({ ...personForm, trade: event.target.value })} />
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
                  canDelete={canManage || selectedAttachment.uploaded_by === profile?.id}
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
                <DocumentFileViewer attachment={selectedAttachment} canDelete={canManage || selectedAttachment.uploaded_by === profile?.id} loading={loading} onDelete={removeSelectedAttachment} onDownload={() => downloadAttachment(selectedAttachment)}>
                  <iframe title={selectedAttachment.file_name || "PDF"} src={selectedAttachment.viewUrl} />
                </DocumentFileViewer>
              ) : (
                <DocumentFileViewer attachment={selectedAttachment} canDelete={canManage || selectedAttachment.uploaded_by === profile?.id} loading={loading} onDelete={removeSelectedAttachment} onDownload={() => downloadAttachment(selectedAttachment)}>
                  <div className="documentOpenCard">
                    <FileSpreadsheet size={38} />
                    <strong>{selectedAttachment.file_name}</strong>
                    <a href={selectedAttachment.viewUrl} target="_blank" rel="noreferrer">
                      Open Excel file
                    </a>
                  </div>
                </DocumentFileViewer>
              )}
            </div>
          </AppModal>
        )}
      </main>
    </div>
  );
}

function DetailOverlayShell({ children, onClose, title }) {
  return (
    <div className="detailOverlay">
      <div className="searchBackdrop" onClick={onClose} />
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

function ProjectDetailOverlay({ activities = [], canDeleteTickets, canManage, companyId, currentVisit, files, getProfileName, onAddVisit, onClose, onEditProject, onEditVisit, onOpenAttachment, onOpenVisit, onRemoveVisit, onUploaded, people, profileId, project, visits }) {
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
                      {String(visit.start_time).slice(0, 5)} - {String(visit.end_time).slice(0, 5)}
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

      <ActivityFeed activities={activities} getProfileName={getProfileName} visits={visits} />

      {canManage && (
        <div className="detailSection">
          <div className="panelSectionHeader">
            <h3>Project Files</h3>
          </div>
          <DocumentUploader attachments={files} companyId={companyId} profileId={profileId} projectId={project.id} visitId={null} onOpen={onOpenAttachment} onUploaded={onUploaded} />
        </div>
      )}

      <AttachmentSections files={files} onOpen={onOpenAttachment} profiles={people} />
    </DetailOverlayShell>
  );
}

function ActivityFeed({ activities = [], getProfileName, visits = [] }) {
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
                    {getProfileName(item.actor_id, "System")} В· {new Date(item.created_at).toLocaleString()}
                    {visit ? ` В· ${formatDateLabel(visit.visit_date)}` : ""}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VisitDetailOverlay({ canDeleteTickets, companyId, equipment, files, getProfileName, onArrive, onClose, onComplete, onEdit, onOpenAttachment, onRemove, onUploaded, people, profileId, profiles, project, visit }) {
  return (
    <DetailOverlayShell title={`${project.name} Ticket`} onClose={onClose}>
      <div className="ticketHeaderCard">
        <div>
          <span className={`ticketStatus ${visit.status}`}>{normalizeVisitStatus(visit.status)}</span>
          <h3>{visit.work_scope || "Scheduled work"}</h3>
          <p>{formatDateLabel(visit.visit_date)} · {String(visit.start_time).slice(0, 5)} - {String(visit.end_time).slice(0, 5)}</p>
        </div>
        <div className="detailActionRow">
          <button className="outlineButton" type="button" onClick={onEdit}>
            <Edit3 size={17} />
            Edit
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
        <ProjectFact icon={Calendar} label="Scheduled" value={`${String(visit.start_time).slice(0, 5)} - ${String(visit.end_time).slice(0, 5)}`} />
        <ProjectFact icon={CheckCircle2} label="Actual start" value={visit.arrived_at ? new Date(visit.arrived_at).toLocaleString() : "Not started"} />
        <ProjectFact icon={ClipboardCheck} label="Actual finish" value={visit.completed_at ? new Date(visit.completed_at).toLocaleString() : "Not finished"} />
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

      <div className="detailSection">
        <div className="panelSectionHeader">
          <h3>Ticket Files</h3>
        </div>
        <DocumentUploader attachments={files} companyId={companyId} profileId={profileId} projectId={project.id} visitId={visit.id} onOpen={onOpenAttachment} onUploaded={onUploaded} />
      </div>

      <AttachmentSections files={files} onOpen={onOpenAttachment} profiles={profiles} />
    </DetailOverlayShell>
  );
}

function PersonDetailOverlay({ avatarUrl, canManage, onClose, onEdit, person }) {
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
        {canManage && (
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
        <small>{file.photo_caption ? `${file.photo_caption} · ` : ""}{uploader?.full_name || uploader?.email || "Unknown"} · {new Date(file.created_at).toLocaleString()}</small>
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
        <small>{project?.name || "Project"} / {file.visit_id ? "Ticket file" : "Project file"} / {file.photo_caption ? `${file.photo_caption} / ` : ""}{file.file_type?.replaceAll("_", " ")} / {uploader?.full_name || uploader?.email || "Unknown"} / {new Date(file.created_at).toLocaleString()}</small>
      </span>
    </button>
  );
}

function AttachmentSections({ files, onOpen, profiles = [] }) {
  const groups = [
    { id: "safety", label: "Safety Forms", icon: FileText, items: files.filter((file) => file.file_type === "safety_form") },
    { id: "projectPhotos", label: "Project Photos", icon: Camera, items: files.filter((file) => file.file_kind === "photo" && !file.visit_id) },
    { id: "before", label: "Before Photos", icon: Camera, items: files.filter((file) => file.file_type === "before_photo" && file.visit_id) },
    { id: "after", label: "After Photos", icon: Camera, items: files.filter((file) => file.file_type === "completion_photo" && file.visit_id) },
    { id: "pdf", label: "PDFs", icon: FileText, items: files.filter((file) => file.file_kind === "pdf" && file.file_type !== "safety_form") },
    { id: "excel", label: "Excel", icon: FileSpreadsheet, items: files.filter((file) => file.file_kind === "excel") },
  ];

  return (
    <div className="attachmentSections">
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
  const signaturesReady = team.length > 0 && team.every((person) => form.signatures[person.id]?.trim());
  const canSubmit = form.hazards.length > 0 && signaturesReady;
  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function toggleHazard(hazard) {
    const set = new Set(form.hazards);
    if (set.has(hazard)) set.delete(hazard);
    else set.add(hazard);
    onChange({ ...form, hazards: [...set] });
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

      <FormField label="Safety notes">
        <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FormField>

      <div className="signatureStack">
        <h3>Team signatures</h3>
        {team.length === 0 ? (
          <div className="emptyPanelState">No team members assigned to this ticket.</div>
        ) : (
          team.map((person) => (
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

function CompleteVisitModal({ form, loading, onChange, onSubmit }) {
  const selectedFiles = Array.isArray(form.files) ? form.files : [];

  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <FormField label="Completion comments">
        <textarea placeholder="Describe completed work, issues, materials, office notes..." value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FormField>
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
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || form.files.length === 0}>
          <CheckCircle2 size={18} />
          Finish Work
        </button>
      </div>
    </form>
  );
}

function ScheduleView({ assignmentsReady, availablePeople = [], avatarUrls, canDeleteTickets, equipmentRows, peopleRows, projectRows = [], projects = [], scheduleMode, selectedDate, setScheduleMode, setSelectedDate, visits = [], onAdd, onAssignPerson, onDropAssignment, onOpenPerson, onOpenProject, onRemovePersonFromVisit, onRemoveVisit, onSelect }) {
  const [dragPreview, setDragPreview] = useState(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(selectedDate);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const showNow = selectedDate === today && nowHour >= scheduleStartHour && nowHour <= scheduleEndHour;
  const nowRatio = Math.max(0, Math.min(1, (nowHour - scheduleStartHour) / (scheduleEndHour - scheduleStartHour)));
  const nowLabel = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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

        <div className="dateDisplay" aria-label="Selected schedule date">
          <Calendar size={18} />
          <span>{formatDateLabel(selectedDate)}</span>
        </div>

        <div className="toolbarSpacer" />

        <button className="outlineButton" type="button" onClick={jumpToToday}>
          Today
        </button>
        <div className="calendarPickerWrap">
          <button className="squareButton" type="button" title="Open calendar" onClick={toggleCalendar}>
            <Calendar size={18} />
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

          <ResourceGroup avatarUrls={avatarUrls} canDeleteTickets={canDeleteTickets} dragPreview={dragPreview} setDragPreview={setDragPreview} title="Projects" count={projectRows.length} icon={FolderKanban} rows={projectRows} selectedDate={selectedDate} visits={visits} onAssignPerson={onAssignPerson} onDropAssignment={onDropAssignment} onOpenPerson={onOpenPerson} onOpenProject={onOpenProject} onRemoveVisit={onRemoveVisit} onSelect={onSelect} />
        </div>
      ) : (
        <CalendarTileGrid equipment={equipmentRows} mode={scheduleMode} people={peopleRows} projects={projects} selectedDate={selectedDate} today={today} visits={visits} onSelectDay={openDay} />
      )}

      {scheduleMode === "day" && (
        <AvailablePeoplePool avatarUrls={avatarUrls} people={availablePeople} onOpenPerson={onOpenPerson} onRemovePersonFromVisit={onRemovePersonFromVisit} />
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

function SectionToolbar({ label, onAdd }) {
  return (
    <div className="sectionToolbar">
      <strong>{label}</strong>
      <button className="addButton" type="button" onClick={onAdd}>
        <Plus size={18} />
        Add
      </button>
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

function EquipmentView({ equipment }) {
  return (
    <div className="listView">
      {equipment.length === 0 && <div className="emptyState">No equipment yet. Press Add to create trailers, trucks, excavators, or lifts.</div>}
      {equipment.map((item) => (
        <div className="listRow" key={item.id}>
          <div className="equipmentAvatar">{equipmentIcon(item.type)}</div>
          <span>
            <strong>{item.name}</strong>
            <small>{item.type}</small>
          </span>
          <em>{item.unit_number || item.status || "Available"}</em>
        </div>
      ))}
    </div>
  );
}

function DocumentsView({ files, onOpen, profiles, projects }) {
  const groups = [
    { id: "projectPhotos", label: "Project Photos", icon: Camera, items: files.filter((file) => file.file_kind === "photo" && !file.visit_id) },
    { id: "before", label: "Before Photos", icon: Camera, items: files.filter((file) => file.file_type === "before_photo" && file.visit_id) },
    { id: "after", label: "After Photos", icon: Camera, items: files.filter((file) => file.file_type === "completion_photo" && file.visit_id) },
    { id: "pdf", label: "PDFs", icon: FileText, items: files.filter((file) => file.file_kind === "pdf" && file.file_type !== "safety_form") },
    { id: "excel", label: "Excel", icon: FileSpreadsheet, items: files.filter((file) => file.file_kind === "excel") },
    { id: "other", label: "Other", icon: FileText, items: files.filter((file) => !["safety_form", "before_photo", "completion_photo"].includes(file.file_type) && !["pdf", "excel", "photo"].includes(file.file_kind)) },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="documentsView groupedDocuments">
      {files.length === 0 && <div className="emptyState">No documents or photos saved yet.</div>}
      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <section className={`documentGroup ${group.id}`} key={group.id}>
            <div className="documentGroupHeader">
              <Icon size={18} />
              <h3>{group.label}</h3>
              <span>{group.items.length}</span>
            </div>
            {group.items.map((file) => {
              const project = projects.find((item) => item.id === file.project_id);
              return <DocumentListRow file={file} key={file.id} onOpen={onOpen} profiles={profiles} project={project} />;
            })}
          </section>
        );
      })}
    </div>
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
              <small>{project?.name || "Project"} · {file.file_type?.replaceAll("_", " ")} · {uploader?.full_name || uploader?.email || "Unknown"} · {new Date(file.created_at).toLocaleString()}</small>
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

function SettingsView({ avatarUrl, form, isConfigured, loading, onChange, onSubmit, profile, session }) {
  return (
    <div className="listView">
      <div className="listRow">
        <Settings size={20} />
        <span>
          <strong>Supabase</strong>
          <small>{isConfigured ? "Connected with environment variables" : "Not configured"}</small>
        </span>
      </div>
      <form className="settingsProfileForm" onSubmit={onSubmit}>
        <div className="settingsAvatarBlock">
          <Avatar profile={profile} url={avatarUrl} />
          <span>
            <strong>{profile?.full_name || session?.user?.email || "Not signed in"}</strong>
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
    </div>
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
  return (
    <div className="modalBackdrop">
      <div className={wide ? "modal wideModal" : "modal"} onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton soft" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>
        {children}
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

function ResourceGroup({ avatarUrls = {}, canDeleteTickets, dragPreview, setDragPreview, title, count, icon: Icon, rows, selectedDate, visits = [], onAssignPerson, onDropAssignment, onOpenPerson, onOpenProject, onRemoveVisit, onSelect }) {
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
        <div className="resourceRow" key={row.id} style={{ "--lane-count": Math.max(1, row.assignments.length) }}>
          <button
            className="resourceIdentity"
            type="button"
            onClick={() => {
              if (row.kind === "project") onOpenProject?.(row);
            }}
            aria-disabled={row.kind !== "project"}
            title={row.kind === "project" ? "Open project" : undefined}
          >
            {row.kind === "person" ? (
              <Avatar profile={row} url={avatarUrls[row.id]} />
            ) : row.kind === "project" ? (
              <div className={`equipmentAvatar projectAvatar ${row.color ?? "blue"}`}>{makeInitials(row.name, "PR")}</div>
            ) : (
              <div className={`equipmentAvatar ${row.icon ?? "machine"}`}>{equipmentIcon(row.type)}</div>
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
                label: `${toTimeValue(start)} - ${toTimeValue(end)}`,
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
              return <ScheduleBlock assignment={assignment} avatarUrls={avatarUrls} canDeleteTickets={canDeleteTickets} key={assignment.id || assignment.visitId} onAssignPerson={onAssignPerson} onOpenPerson={onOpenPerson} onRemove={() => onRemoveVisit?.(visit)} onSelect={onSelect} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AvailablePeoplePool({ avatarUrls = {}, people = [], onOpenPerson, onRemovePersonFromVisit }) {
  const [isDropActive, setIsDropActive] = useState(false);
  const acceptsAssignedPerson = (event) => event.dataTransfer.types.includes("application/x-buildcore-assigned-person");

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
        <span>{people.length ? "Drag people into a ticket, or drop assigned people here to remove" : "Drop assigned people here to remove them from a ticket"}</span>
      </div>
      <div className="availableAvatarStrip">
        {people.map((person) => (
          <button
            className="availableAvatarCard"
            draggable
            key={person.id}
            type="button"
            onDragStart={(event) => {
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
    </section>
  );
}

function ScheduleBlock({ assignment, avatarUrls = {}, canDeleteTickets, onAssignPerson, onOpenPerson, onRemove, onSelect }) {
  const span = scheduleEndHour - scheduleStartHour;
  const left = Math.max(0, ((assignment.start - scheduleStartHour) / span) * 100);
  const width = Math.min(100 - left, ((assignment.end - assignment.start) / span) * 100);
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
      className={`scheduleBlock ${assignment.color} ${assignment.status ?? ""}`}
      draggable={Boolean(assignment.visitId)}
      role="button"
      style={{ left: `${left}%`, width: `${width}%`, ...verticalStyle }}
      tabIndex={0}
      onClick={openAssignment}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/json", JSON.stringify(assignment));
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("application/x-buildcore-person")) event.preventDefault();
      }}
      onDrop={(event) => {
        const personId = event.dataTransfer.getData("application/x-buildcore-person");
        if (!personId) return;
        event.preventDefault();
        event.stopPropagation();
        onAssignPerson?.({ personId, visitId: assignment.visitId });
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openAssignment();
      }}
    >
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
        <PhotoAnnotator imageUrl={attachment.viewUrl} onSave={onSaveAnnotation} />
      </div>
    );
  }

  return (
    <section className="photoViewer">
      <div className="viewerTopBar">
        <div>
          <strong>{attachment.file_name}</strong>
          <small>{uploader?.full_name || uploader?.email || "Unknown"} / {new Date(attachment.created_at).toLocaleString()}</small>
          {attachment.photo_caption && <p className="photoCaption">{attachment.photo_caption}</p>}
        </div>
        <div className="viewerControls">
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
        <img src={attachment.viewUrl} alt={attachment.file_name || "Visit photo"} style={{ transform: `scale(${zoom})` }} />
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
                <small>{new Date(entry.at).toLocaleString()} / {entry.objectCount ?? 0} object(s)</small>
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
          <strong>{attachment.file_name}</strong>
          <small>{attachment.visit_id ? "Ticket file" : "Project file"} / {new Date(attachment.created_at).toLocaleString()}</small>
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
