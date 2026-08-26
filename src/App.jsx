import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  Edit3,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Home,
  ImagePlus,
  MapPin,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Settings,
  CloudSun,
  Trash2,
  Truck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import DocumentUploader from "./components/DocumentUploader.jsx";
import PhotoAnnotator from "./components/PhotoAnnotator.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { createAttachmentUrls, makeSimplePdfBlob, uploadAnnotatedVisitPhoto, uploadVisitGeneratedFile, uploadVisitPhoto } from "./lib/storage.js";
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
  { id: "reports", label: "Reports", icon: FileBarChart2 },
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
const timeLabels = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM"];
const colors = ["blue", "green", "yellow", "purple", "orange"];
const scheduleStartHour = 7;
const scheduleEndHour = 18;

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
  start_time: "08:00",
  end_time: "16:00",
  work_scope: "",
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

function highlightText(value, query) {
  const raw = String(value ?? "");
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

function FormField({ label, children }) {
  return (
    <label className="formField">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const globalSearchRef = useRef(null);
  const searchInputRef = useRef(null);
  const [activeNav, setActiveNav] = useState("schedule");
  const [scheduleMode, setScheduleMode] = useState("day");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState({ ...demo, visits: [] });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [detailOverlay, setDetailOverlay] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState(null);
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
  const [photoStep, setPhotoStep] = useState({ kind: "", visitId: "", files: [] });
  const [completionForm, setCompletionForm] = useState({ notes: "", files: [] });

  const isLive = Boolean(session && profile);
  const canManage = ["owner", "project_manager", "office_manager"].includes(profile?.role);
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
          setProfile(null);
          setData({ ...demo, visits: [] });
          setNotice(
            claimResult.error?.message?.includes("verify")
              ? "Check your email and confirm the account before continuing."
              : "Supabase did not confirm Owner access for this account.",
          );
          await supabase.auth.signOut();
          return;
        }
      }

      setProfile(profileResult.data);

      const [projectsResult, peopleResult, equipmentResult, visitsResult, filesResult] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
        supabase.from("equipment").select("*").order("name"),
        supabase.from("visit_schedule_view").select("*").order("visit_date", { ascending: false }).order("start_time"),
        supabase.from("visit_files").select("*").order("created_at", { ascending: false }),
      ]);

      const failed = [projectsResult, peopleResult, equipmentResult, visitsResult, filesResult].find((result) => result.error);
      if (failed) throw failed.error;

      const nextProjects = projectsResult.data ?? [];
      setData({
        companyId: profileResult.data.company_id,
        projects: nextProjects,
        people: peopleResult.data ?? [],
        equipment: equipmentResult.data ?? [],
        visits: visitsResult.data ?? [],
        files: filesResult.data ?? [],
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
    if (!session) return;
    refreshData();
  }, [refreshData, session]);

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
    function handlePointerDown(event) {
      if (!globalSearchRef.current?.contains(event.target)) {
        setSearchResults([]);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isSearchOpen) return;
    const handle = window.setTimeout(() => searchInputRef.current?.focus(), 80);
    return () => window.clearTimeout(handle);
  }, [isSearchOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setIsSearchOpen(false);
      setSearchResults([]);
      setDetailOverlay("");
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const rowsSource = isLive ? data : demo;
  const assignmentsSource = isLive ? liveAssignments : demoAssignments;
  const selectedProject = selectedProjectId ? rowsSource.projects.find((project) => project.id === selectedProjectId) : null;
  const selectedAssignment = assignmentsSource.find((item) => item.id === selectedAssignmentId) ?? null;
  const selectedProjectVisits = selectedProject
    ? (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === selectedProject.id)
        .sort((a, b) => `${b.visit_date} ${b.start_time}`.localeCompare(`${a.visit_date} ${a.start_time}`))
    : [];
  const selectedVisit = selectedVisitId ? selectedProjectVisits.find((visit) => visit.id === selectedVisitId) ?? null : null;
  const currentVisit = selectedVisit ?? selectedProjectVisits[0] ?? null;
  const currentVisitFiles = (rowsSource.files ?? []).filter((file) => currentVisit?.id && file.visit_id === currentVisit.id);
  const currentVisitPeople = currentVisit ? rowsSource.people.filter((person) => currentVisit.people_ids?.includes(person.id)) : [];
  const currentVisitEquipment = currentVisit ? rowsSource.equipment.filter((item) => currentVisit.equipment_ids?.includes(item.id)) : [];
  const todayValue = new Date().toISOString().slice(0, 10);
  const todayVisits = (rowsSource.visits ?? []).filter((visit) => visit.visit_date === todayValue && (!isLive || visit.people_ids?.includes(profile?.id)));
  const projectAttachments = (rowsSource.files ?? [])
    .filter((file) => selectedProject && (file.project_id === selectedProject.id || file.projectId === selectedProject.id))
    .slice(0, 6);

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
    subtitle: person.trade || roleLabel(person.role),
    assignments: assignmentsSource.filter((item) => item.type === "person" && item.resourceId === person.id),
  }));

  const equipmentRows = rowsSource.equipment.map((equipment) => ({
    ...equipment,
    kind: "equipment",
    full_name: equipment.name,
    subtitle: equipment.type,
    assignments: assignmentsSource.filter((item) => item.type === "equipment" && item.resourceId === equipment.id),
  }));

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;

    setLoading(true);
    const normalizedEmail = authEmail.trim().toLowerCase();
    const action =
      authMode === "signup"
        ? supabase.auth.signUp({
            email: normalizedEmail,
            password: authPassword,
            options: {
              emailRedirectTo: getAuthRedirectUrl(),
              data: { full_name: companyForm.full_name || normalizedEmail.split("@")[0] },
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
    setProfile(null);
    setData({ ...demo, visits: [] });
    setSelectedProjectId("");
    setSelectedVisitId("");
    setSelectedAssignmentId("");
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

    setLoading(true);
    const visitPayload = {
      project_id: visitForm.project_id,
      visit_date: visitForm.visit_date,
      start_time: visitForm.start_time,
      end_time: visitForm.end_time,
      is_first_visit: visitForm.is_first_visit,
      work_scope: visitForm.work_scope,
    };

    const visitQuery = editingVisitId
      ? supabase.from("visits").update(visitPayload).eq("id", editingVisitId).select().single()
      : supabase
          .from("visits")
          .insert({
            ...visitPayload,
            company_id: profile.company_id,
            created_by: profile.id,
          })
          .select()
          .single();

    const { data: visit, error: visitError } = await visitQuery;

    if (visitError) {
      setLoading(false);
      setNotice(visitError.message);
      return;
    }

    if (editingVisitId) {
      const clearPeople = await supabase.from("visit_people").delete().eq("visit_id", visit.id);
      const clearEquipment = await supabase.from("visit_equipment").delete().eq("visit_id", visit.id);

      if (clearPeople.error || clearEquipment.error) {
        setLoading(false);
        setNotice(clearPeople.error?.message || clearEquipment.error?.message);
        refreshData();
        return;
      }
    }

    const peopleRowsToInsert = visitForm.people_ids.map((profileId) => ({ visit_id: visit.id, profile_id: profileId }));
    const equipmentRowsToInsert = visitForm.equipment_ids.map((equipmentId) => ({ visit_id: visit.id, equipment_id: equipmentId }));
    const peopleResult = peopleRowsToInsert.length ? await supabase.from("visit_people").insert(peopleRowsToInsert) : { error: null };
    const equipmentResult = equipmentRowsToInsert.length ? await supabase.from("visit_equipment").insert(equipmentRowsToInsert) : { error: null };
    const error = peopleResult.error || equipmentResult.error;

    if (error) {
      if (!editingVisitId) await supabase.from("visits").delete().eq("id", visit.id);
      setLoading(false);
      setNotice(error.message);
      refreshData();
      return;
    }

    setLoading(false);
    setVisitForm({ ...emptyVisitForm, visit_date: selectedDate, project_id: rowsSource.projects[0]?.id ?? "" });
    setEditingVisitId(null);
    setModalType(null);
    setSelectedDate(visit.visit_date);
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);
    setNotice(editingVisitId ? "Visit changes saved." : "Visit scheduled. Conflict checks passed.");
    refreshData();
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

  function openProjectOverlay(project, mode = "project") {
    setSelectedProjectId(project.id);
    if (mode === "project") {
      const nextVisit = (rowsSource.visits ?? [])
        .filter((visit) => visit.project_id === project.id)
        .sort((a, b) => `${b.visit_date} ${b.start_time}`.localeCompare(`${a.visit_date} ${a.start_time}`))[0];
      setSelectedVisitId(nextVisit?.id ?? "");
    }
    setDetailOverlay(mode);
  }

  function openVisitOverlay(visit) {
    if (!visit) return;
    setSelectedProjectId(visit.project_id);
    setSelectedVisitId(visit.id);
    setSelectedDate(visit.visit_date);
    setDetailOverlay("visit");
  }

  function startArrivalWorkflow(visit = currentVisit) {
    if (!visit?.id) {
      setNotice("Select today's visit first.");
      return;
    }

    const files = getVisitFiles(visit);
    const hasSafety = files.some((file) => file.file_type === "safety_form");
    const hasBefore = files.some((file) => file.file_type === "before_photo");

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
      setPhotoStep({ kind: "before", visitId: visit.id, files: [] });
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
    setCompletionForm({ notes: "", files: [] });
    setModalType("completeVisit");
  }

  async function saveSafetyForm(event) {
    event.preventDefault();
    if (!supabase || !profile || !currentVisit || !selectedProject) return;

    const team = rowsSource.people.filter((person) => currentVisit.people_ids?.includes(person.id));
    const missingSignature = team.some((person) => !safetyForm.signatures[person.id]?.trim());
    if (safetyForm.hazards.length === 0 || missingSignature) {
      setNotice("Select hazards and collect every team member signature before continuing.");
      return;
    }

    setLoading(true);
    try {
      const names = team.map((person) => person.full_name || person.email || "Team member");
      const lines = [
        "BuildCore Construction - Digital Safety Form",
        `Project: ${selectedProject.name}`,
        `Job Number: ${selectedProject.job_number || "Not set"}`,
        `Address: ${selectedProject.address}`,
        `Date: ${formatDateLabel(currentVisit.visit_date)}`,
        `Time: ${String(currentVisit.start_time).slice(0, 5)} - ${String(currentVisit.end_time).slice(0, 5)}`,
        `Hazards: ${safetyForm.hazards.join(", ")}`,
        `Notes: ${safetyForm.notes || "None"}`,
        "Signatures:",
        ...team.map((person) => `${person.full_name || person.email}: ${safetyForm.signatures[person.id]}`),
      ];
      const fileName = `${names.join("-")}-${currentVisit.visit_date}-safety-form.pdf`.replace(/\s+/g, "-");
      const blob = makeSimplePdfBlob(lines);
      await uploadVisitGeneratedFile({
        companyId: rowsSource.companyId,
        projectId: selectedProject.id,
        visitId: currentVisit.id,
        profileId: profile.id,
        blob,
        fileName,
        fileType: "safety_form",
        searchText: lines.join(" "),
      });
      setModalType("beforePhotos");
      setPhotoStep({ kind: "before", visitId: currentVisit.id, files: [] });
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
    if (!supabase || !profile || !currentVisit || !selectedProject) return;
    if (photoStep.files.length === 0) {
      setNotice("Upload at least one before photo.");
      return;
    }

    setLoading(true);
    try {
      for (const file of photoStep.files) {
        await uploadVisitPhoto({
          companyId: rowsSource.companyId,
          projectId: selectedProject.id,
          visitId: currentVisit.id,
          profileId: profile.id,
          file,
          fileType: "before_photo",
          searchText: `Before photo uploaded by ${currentUserName} at ${new Date().toISOString()}`,
        });
      }
      await updateVisitStatusById(currentVisit.id, "on_site");
      setModalType(null);
      setPhotoStep({ kind: "", visitId: "", files: [] });
      setNotice("Work started. Ticket is Active.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveCompletion(event) {
    event.preventDefault();
    if (!supabase || !profile || !currentVisit || !selectedProject) return;
    if (completionForm.files.length === 0) {
      setNotice("Upload at least one after photo before completing work.");
      return;
    }

    setLoading(true);
    try {
      for (const file of completionForm.files) {
        await uploadVisitPhoto({
          companyId: rowsSource.companyId,
          projectId: selectedProject.id,
          visitId: currentVisit.id,
          profileId: profile.id,
          file,
          fileType: "completion_photo",
          searchText: `After photo uploaded by ${currentUserName} at ${new Date().toISOString()}. ${completionForm.notes}`,
        });
      }
      await updateVisitStatusById(currentVisit.id, "completed", { completion_notes: completionForm.notes });
      setModalType(null);
      setCompletionForm({ notes: "", files: [] });
      setNotice("Thank you. Work is Done.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteVisit() {
    if (!supabase || !currentVisit?.id || !canManage) {
      setNotice("Select a live visit and sign in as Owner, PM, or Office Manager.");
      return;
    }

    const confirmed = window.confirm(`Remove visit "${selectedProject?.name ?? "Project"}" from the schedule?`);
    if (!confirmed) return;

    const { error } = await supabase.from("visits").delete().eq("id", currentVisit.id);
    if (error) {
      setNotice(error.message);
      return;
    }

    setSelectedAssignmentId("");
    setSelectedVisitId("");
    setNotice("Visit removed from schedule.");
    refreshData();
  }

  async function moveVisitAssignment({ assignment, row, clientX, trackElement }) {
    if (!supabase || !canManage) {
      setNotice("Sign in as Owner, PM, or Office Manager to move schedule items.");
      return;
    }
    if (!assignment?.visitId || !trackElement) return;
    if (assignment.type !== row.kind) {
      setNotice("Drop people visits on people rows and equipment visits on equipment rows.");
      return;
    }

    const rect = trackElement.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const duration = Math.max(0.25, assignment.end - assignment.start);
    const rawStart = scheduleStartHour + percent * (scheduleEndHour - scheduleStartHour);
    const start = Math.min(scheduleEndHour - duration, Math.max(scheduleStartHour, Math.round(rawStart * 4) / 4));
    const end = start + duration;

    setLoading(true);
    let addedNewResource = false;

    if (row.id !== assignment.resourceId) {
      if (row.kind === "person") {
        const addResult = await supabase.from("visit_people").insert({ visit_id: assignment.visitId, profile_id: row.id });
        if (addResult.error) {
          setLoading(false);
          setNotice(addResult.error.message);
          refreshData();
          return;
        }
        addedNewResource = true;
      } else {
        const addResult = await supabase.from("visit_equipment").insert({ visit_id: assignment.visitId, equipment_id: row.id });
        if (addResult.error) {
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
        start_time: toTimeValue(start),
        end_time: toTimeValue(end),
      })
      .eq("id", assignment.visitId);

    if (visitResult.error) {
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
        setLoading(false);
        setNotice(removeResult.error.message);
        refreshData();
        return;
      }
    }

    setLoading(false);
    setNotice(`Visit moved to ${toTimeValue(start)} - ${toTimeValue(end)}.`);
    refreshData();
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
      setProjectForm(emptyProjectForm);
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
      setDetailOverlay("visit");
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
      start_time: String(visit.start_time ?? "08:00").slice(0, 5),
      end_time: String(visit.end_time ?? "16:00").slice(0, 5),
      work_scope: visit.work_scope ?? "",
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
      setSelectedAttachment({ ...attachment, ...urls });
    } catch (error) {
      setNotice(error.message);
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
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
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

    if (!authReady || (session && !profile)) {
      return <AuthGate loading notice={notice || "Checking Supabase session and account access..."} />;
    }

    return (
      <AuthGate
        authEmail={authEmail}
        authMode={authMode}
        authPassword={authPassword}
        loading={loading}
        notice={notice}
        onEmailChange={setAuthEmail}
        onModeChange={setAuthMode}
        onPasswordChange={setAuthPassword}
        onSubmit={signIn}
      />
    );
  }

  function renderMainContent() {
    if (activeNav === "projects") {
      return (
        <>
          <SectionToolbar label="Projects" onAdd={openAddModal} />
          <ProjectsView canManage={canManage} projects={rowsSource.projects} onDelete={deleteProject} onEdit={editProject} onSelect={selectProject} />
        </>
      );
    }
    if (activeNav === "people") {
      return (
        <>
          <SectionToolbar label="People" onAdd={openAddModal} />
          <PeopleView people={rowsSource.people} canManage={canManage} onRoleChange={updateRole} />
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
    if (activeNav === "reports") {
      return <InfoView icon={FileBarChart2} title="Reports" text="Reports will use the same project, people, equipment, visit, and document records already connected here." />;
    }
    if (activeNav === "settings") {
      return <SettingsView profile={profile} session={session} isConfigured={isSupabaseConfigured} />;
    }
    if (activeNav === "overview") {
      return <OverviewView data={rowsSource} getVisitFiles={getVisitFiles} onArrive={startArrivalWorkflow} onComplete={startCompletionWorkflow} onOpenVisit={openVisitOverlay} profile={profile} projects={rowsSource.projects} todayVisits={todayVisits} />;
    }
    return (
      <ScheduleView
        assignmentsReady={assignmentsSource.length > 0}
        equipmentRows={equipmentRows}
        peopleRows={peopleRows}
        scheduleMode={scheduleMode}
        selectedDate={selectedDate}
        setScheduleMode={setScheduleMode}
        setSelectedDate={setSelectedDate}
        onAdd={openAddModal}
        onDropAssignment={moveVisitAssignment}
        onSelect={selectAssignment}
      />
    );
  }

  if (!session || !profile) {
    return renderAuthScreen();
  }

  return (
    <div className="dashboardShell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">B</div>
          <div>
            <strong>BuildCore</strong>
            <span>Construction</span>
          </div>
        </div>

        <nav className="sideNav" aria-label="Application navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button className={activeNav === item.id ? "sideNavItem active" : "sideNavItem"} key={item.id} type="button" onClick={() => setActiveNav(item.id)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebarUser">
          <div className="avatar face">{makeInitials(currentUserName)}</div>
          <div>
            <strong>{currentUserName}</strong>
            <span>{profile ? roleLabel(profile.role) : "Project Manager"}</span>
          </div>
          <ChevronDown size={18} />
        </div>
      </aside>

      <main className="mainWorkspace">
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

            <div className="avatar face small">{makeInitials(currentUserName)}</div>
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
              <ProjectFact icon={UsersRound} label="Project Manager" value={selectedProject.project_manager ?? currentUserName} />
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
                    <button
                      className={currentVisit?.id === visit.id ? "projectVisitItem active" : "projectVisitItem"}
                      key={visit.id}
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
                      <Edit3
                        size={16}
                        onClick={(event) => {
                          event.stopPropagation();
                          editVisit(visit);
                        }}
                      />
                    </button>
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
              <button className="dangerAction" type="button" disabled={!currentVisit?.id} onClick={deleteVisit}>
                <Trash2 size={18} />
                Remove
              </button>
            </div>

            <div className="panelActions">
              <DocumentUploader
                attachments={projectAttachments}
                companyId={rowsSource.companyId}
                profileId={profile?.id}
                projectId={selectedProject.id}
                visitId={currentVisit?.id ?? null}
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
            canManage={canManage}
            currentVisit={currentVisit}
            files={projectAttachments}
            onAddVisit={() => openVisitModal(selectedProject.id)}
            onClose={() => setDetailOverlay("")}
            onEditProject={() => editProject(selectedProject)}
            onEditVisit={editVisit}
            onOpenAttachment={openAttachment}
            onOpenVisit={openVisitOverlay}
            people={rowsSource.people}
            project={selectedProject}
            visits={selectedProjectVisits}
          />
        )}

        {detailOverlay === "visit" && selectedProject && currentVisit && (
          <VisitDetailOverlay
            equipment={currentVisitEquipment}
            files={currentVisitFiles}
            onArrive={() => startArrivalWorkflow(currentVisit)}
            onClose={() => setDetailOverlay("")}
            onComplete={() => startCompletionWorkflow(currentVisit)}
            onEdit={() => editVisit(currentVisit)}
            onOpenAttachment={openAttachment}
            onRemove={deleteVisit}
            people={currentVisitPeople}
            profiles={rowsSource.people}
            project={selectedProject}
            visit={currentVisit}
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
              <FormField label="Date">
                <input required type="date" value={visitForm.visit_date} onChange={(event) => setVisitForm({ ...visitForm, visit_date: event.target.value })} />
              </FormField>
              <FormField label="Start time">
                <input required type="time" value={visitForm.start_time} onChange={(event) => setVisitForm({ ...visitForm, start_time: event.target.value })} />
              </FormField>
              <FormField label="End time">
                <input required type="time" value={visitForm.end_time} onChange={(event) => setVisitForm({ ...visitForm, end_time: event.target.value })} />
              </FormField>
              <FormField label="Work scope">
                <textarea value={visitForm.work_scope} onChange={(event) => setVisitForm({ ...visitForm, work_scope: event.target.value })} />
              </FormField>
              <label className="checkLine">
                <input type="checkbox" checked={visitForm.is_first_visit} onChange={(event) => setVisitForm({ ...visitForm, is_first_visit: event.target.checked })} />
                First site visit
              </label>
              <PickerList title="People" items={rowsSource.people} selected={visitForm.people_ids} labelKey="full_name" onToggle={(id) => toggleVisitArray("people_ids", id)} />
              <PickerList title="Equipment" items={rowsSource.equipment} selected={visitForm.equipment_ids} labelKey="name" onToggle={(id) => toggleVisitArray("equipment_ids", id)} />
              <div className="formActions wide">
                <button className="addButton" type="submit" disabled={loading || !visitForm.project_id}>
                  <Save size={18} />
                  {editingVisitId ? "Save changes" : "Save visit"}
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "safety" && currentVisit && selectedProject && (
          <AppModal title="Digital Safety Form" onClose={() => setModalType(null)} wide>
            <SafetyFormModal
              form={safetyForm}
              hazards={hazardOptions}
              loading={loading}
              onChange={setSafetyForm}
              onSubmit={saveSafetyForm}
              project={selectedProject}
              team={currentVisitPeople}
              visit={currentVisit}
            />
          </AppModal>
        )}

        {modalType === "beforePhotos" && currentVisit && selectedProject && (
          <AppModal title="Before Work Photos" onClose={() => setModalType(null)}>
            <PhotoStepModal
              files={photoStep.files}
              label="Upload at least one photo before work starts."
              loading={loading}
              onFiles={(files) => setPhotoStep({ kind: "before", visitId: currentVisit.id, files })}
              onSubmit={saveBeforePhotos}
            />
          </AppModal>
        )}

        {modalType === "completeVisit" && currentVisit && selectedProject && (
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

        {showAnnotator && selectedProject && (
          <AppModal title="Visit photo markup" onClose={() => setShowAnnotator(false)} wide>
            <div className="viewerFrame">
              <PhotoAnnotator
                imageUrl={samplePhoto()}
                onSave={async ({ dataUrl, annotationJson }) => {
                  try {
                    if (supabase && session && profile) {
                      await uploadAnnotatedVisitPhoto({
                        companyId: rowsSource.companyId,
                        projectId: selectedProject.id,
                        visitId: currentVisit?.id ?? null,
                        dataUrl,
                        annotationJson,
                      });
                      setNotice("Annotated photo saved to Supabase Storage.");
                    } else {
                      setNotice("Annotated photo is ready. Sign in to save it to Supabase Storage.");
                    }
                    setShowAnnotator(false);
                  } catch (error) {
                    setNotice(error.message);
                  }
                }}
              />
            </div>
          </AppModal>
        )}

        {selectedAttachment && (
          <AppModal title={selectedAttachment.file_name || "Attachment"} onClose={() => setSelectedAttachment(null)} wide>
            <div className="attachmentViewer">
              {selectedAttachment.file_kind === "photo" || selectedAttachment.mime_type?.startsWith("image/") ? (
                <img src={selectedAttachment.viewUrl} alt={selectedAttachment.file_name || "Attachment"} />
              ) : selectedAttachment.file_kind === "pdf" || selectedAttachment.mime_type === "application/pdf" ? (
                <iframe title={selectedAttachment.file_name || "PDF"} src={selectedAttachment.viewUrl} />
              ) : (
                <div className="documentOpenCard">
                  <FileSpreadsheet size={38} />
                  <strong>{selectedAttachment.file_name}</strong>
                  <a href={selectedAttachment.viewUrl} target="_blank" rel="noreferrer">
                    Open Excel file
                  </a>
                </div>
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

function ProjectDetailOverlay({ canManage, currentVisit, files, onAddVisit, onClose, onEditProject, onEditVisit, onOpenAttachment, onOpenVisit, people, project, visits }) {
  return (
    <DetailOverlayShell title={project.name} onClose={onClose}>
      <div className="detailHero">
        <img src={getProjectPhoto(project.name)} alt="" />
        <div>
          <span className="jobNumberPill">{project.job_number || "No job number"}</span>
          <h3>{project.name}</h3>
          <p>{project.description || "No description yet."}</p>
          <div className="detailActionRow">
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
      </div>

      <dl className="detailFacts">
        <ProjectFact icon={MapPin} label="Address" value={project.address || "Not set"} />
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
              <button className={currentVisit?.id === visit.id ? "detailVisitCard active" : "detailVisitCard"} key={visit.id} type="button" onClick={() => onOpenVisit(visit)}>
                <span>
                  <strong>{formatDateLabel(visit.visit_date)}</strong>
                  <small>
                    {String(visit.start_time).slice(0, 5)} - {String(visit.end_time).slice(0, 5)}
                  </small>
                </span>
                <em>{normalizeVisitStatus(visit.status)}</em>
                {canManage && (
                  <Edit3
                    size={16}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditVisit(visit);
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <AttachmentSections files={files} onOpen={onOpenAttachment} profiles={people} />
    </DetailOverlayShell>
  );
}

function VisitDetailOverlay({ equipment, files, onArrive, onClose, onComplete, onEdit, onOpenAttachment, onRemove, people, profiles, project, visit }) {
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
          <button className="dangerAction" type="button" onClick={onRemove}>
            <Trash2 size={17} />
            Remove
          </button>
        </div>
      </div>

      <dl className="detailFacts">
        <ProjectFact icon={MapPin} label="Address" value={project.address || "Not set"} />
        <ProjectFact icon={UserRound} label="Contact" value={`${project.contact_name || "Not set"} ${project.contact_phone || ""}`} />
        <ProjectFact icon={UsersRound} label="Team" value={people.map((person) => person.full_name || person.email).join(", ") || "No team assigned"} />
        <ProjectFact icon={Truck} label="Equipment" value={equipment.map((item) => item.name).join(", ") || "No equipment"} />
      </dl>

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

      <AttachmentSections files={files} onOpen={onOpenAttachment} profiles={profiles} />
    </DetailOverlayShell>
  );
}

function AttachmentSections({ files, onOpen, profiles = [] }) {
  const groups = [
    ["safety_form", "Safety Form"],
    ["before_photo", "Before Photos"],
    ["completion_photo", "After Photos"],
    ["project_document", "Documents"],
    ["annotated_photo", "Annotated Photos"],
  ];

  return (
    <div className="attachmentSections">
      {groups.map(([type, label]) => {
        const items = files.filter((file) => file.file_type === type);
        return (
          <section className="attachmentSection" key={type}>
            <h3>{label}</h3>
            {items.length === 0 ? (
              <div className="emptyPanelState">No files yet</div>
            ) : (
              <div className="attachmentStrip">
                {items.map((file) => {
                  const uploader = profiles.find((profile) => profile.id === file.uploaded_by);
                  return (
                    <button className={file.file_kind === "photo" ? "attachmentCard photo" : "attachmentCard document"} key={file.id} type="button" onClick={() => onOpen(file)}>
                      <span className="attachmentThumb">{file.file_kind === "photo" ? <ImagePlus size={22} /> : <FileText size={22} />}</span>
                      <span className="attachmentMeta">
                        <strong title={file.file_name}>{file.file_name}</strong>
                        <small>{uploader?.full_name || uploader?.email || "Unknown"} · {new Date(file.created_at).toLocaleString()}</small>
                      </span>
                    </button>
                  );
                })}
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
        <span>{formatDateLabel(visit.visit_date)}</span>
      </div>

      <fieldset className="pickerList">
        <legend>Potential hazards</legend>
        {hazards.map((hazard) => (
          <label key={hazard}>
            <input type="checkbox" checked={form.hazards.includes(hazard)} onChange={() => toggleHazard(hazard)} />
            {hazard}
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
            <FormField label={person.full_name || person.email || "Team member"} key={person.id}>
              <input
                placeholder="Type full name as digital signature"
                value={form.signatures[person.id] || ""}
                onChange={(event) =>
                  onChange({
                    ...form,
                    signatures: { ...form.signatures, [person.id]: event.target.value },
                  })
                }
              />
            </FormField>
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

function PhotoStepModal({ files, label, loading, onFiles, onSubmit }) {
  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <div className="emptyPanelState">{label}</div>
      <input accept="image/jpeg,image/png,image/webp" multiple required type="file" onChange={(event) => onFiles([...event.target.files])} />
      <div className="selectedFiles">
        {files.map((file) => (
          <span key={`${file.name}-${file.size}`}>{file.name}</span>
        ))}
      </div>
      <div className="formActions wide">
        <button className="addButton" type="submit" disabled={loading || files.length === 0}>
          <Upload size={18} />
          Save Photos
        </button>
      </div>
    </form>
  );
}

function CompleteVisitModal({ form, loading, onChange, onSubmit }) {
  return (
    <form className="workflowForm" onSubmit={onSubmit}>
      <FormField label="Completion comments">
        <textarea placeholder="Describe completed work, issues, materials, office notes..." value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} />
      </FormField>
      <div className="emptyPanelState">Upload at least one after photo before completing the ticket.</div>
      <input accept="image/jpeg,image/png,image/webp" multiple required type="file" onChange={(event) => onChange({ ...form, files: [...event.target.files] })} />
      <div className="selectedFiles">
        {form.files.map((file) => (
          <span key={`${file.name}-${file.size}`}>{file.name}</span>
        ))}
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

function ScheduleView({ assignmentsReady, equipmentRows, peopleRows, scheduleMode, selectedDate, setScheduleMode, setSelectedDate, onAdd, onDropAssignment, onSelect }) {
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
          <button type="button" title="Previous day" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))}>
            <ChevronLeft size={19} />
          </button>
          <button type="button" title="Next day" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))}>
            <ChevronRight size={19} />
          </button>
        </div>

        <button className="dateButton" type="button" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>
          <Calendar size={18} />
          {formatDateLabel(selectedDate)}
        </button>

        <div className="toolbarSpacer" />

        <button className="outlineButton" type="button" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>
          Today
        </button>
        <button className="squareButton" type="button" title="Open calendar" onClick={() => document.querySelector(".hiddenDateInput")?.showPicker?.()}>
          <Calendar size={18} />
        </button>
        <input className="hiddenDateInput" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        <button className="addButton" type="button" onClick={onAdd}>
          <Plus size={18} />
          Add
        </button>
      </div>

      <div className="timelineCard">
        <div className="timelineHeader">
          <div className="allDay">All Day</div>
          {timeLabels.map((label) => (
            <div className="timeLabel" key={label}>
              {label}
            </div>
          ))}
        </div>

        <div className="nowLine" />
        <div className="nowPill">10:30 AM</div>
        {!assignmentsReady && <div className="emptyTimeline">No visits scheduled for this day.</div>}

        <ResourceGroup title="People" count={peopleRows.length} icon={UsersRound} rows={peopleRows} onDropAssignment={onDropAssignment} onSelect={onSelect} />
        <ResourceGroup title="Equipment" count={equipmentRows.length} icon={Truck} rows={equipmentRows} onDropAssignment={onDropAssignment} onSelect={onSelect} />
      </div>
    </>
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

function ProjectsView({ canManage, projects, onDelete, onEdit, onSelect }) {
  return (
    <div className="listView">
      {projects.length === 0 && <div className="emptyState">No projects yet. Press Add to create the first project.</div>}
      {projects.map((project) => (
        <div className="listRow projectListRow" key={project.id}>
          <button className="rowMainButton" type="button" onClick={() => onSelect(project)}>
            <FolderKanban size={20} />
            <span>
              <strong>{project.name}</strong>
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

function PeopleView({ people, canManage, onRoleChange }) {
  return (
    <div className="listView">
      {people.length === 0 && <div className="emptyState">No employees yet.</div>}
      {people.map((person) => (
        <div className="listRow" key={person.id}>
          <div className="avatar face">{makeInitials(person.full_name)}</div>
          <span>
            <strong>{person.full_name || "Unnamed user"}</strong>
            <small>{person.trade || person.phone || "Team member"}</small>
          </span>
          {canManage ? (
            <select value={person.role} onChange={(event) => onRoleChange(person, event.target.value)}>
              {roleOptions.map((role) => (
                <option value={role} key={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          ) : (
            <em>{roleLabel(person.role)}</em>
          )}
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

function OverviewView({ getVisitFiles, onArrive, onComplete, onOpenVisit, projects, todayVisits }) {
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

        return (
          <section className="todayTicket" key={visit.id}>
            <div className="ticketTopLine">
              <span className={`ticketStatus ${visit.status}`}>{normalizeVisitStatus(visit.status)}</span>
              <button className="outlineButton" type="button" onClick={() => onOpenVisit(visit)}>
                View Ticket
              </button>
            </div>
            <h2>{project?.name || "Project visit"}</h2>
            <p>{visit.work_scope || "Today's scheduled work"}</p>

            <dl className="detailFacts compact">
              <ProjectFact icon={MapPin} label="Address" value={project?.address || "Not set"} />
              <ProjectFact icon={CloudSun} label="Weather" value={weather.status === "ready" ? `${weather.data.temperature}°C, ${weather.data.condition}` : weather.status === "loading" ? "Loading..." : "Not available"} />
              <ProjectFact icon={UserRound} label="Site Contact" value={`${project?.contact_name || "Not set"} ${project?.contact_phone || ""}`} />
              <ProjectFact icon={ClipboardCheck} label="Checklist" value={`Safety ${hasSafety ? "done" : "needed"} · Before ${hasBefore ? "done" : "needed"} · After ${hasAfter ? "done" : "needed"}`} />
            </dl>

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

function SettingsView({ profile, session, isConfigured }) {
  return (
    <div className="listView">
      <div className="listRow">
        <Settings size={20} />
        <span>
          <strong>Supabase</strong>
          <small>{isConfigured ? "Connected with environment variables" : "Not configured"}</small>
        </span>
      </div>
      <div className="listRow">
        <UserRound size={20} />
        <span>
          <strong>{profile?.full_name || session?.user?.email || "Not signed in"}</strong>
          <small>{profile ? roleLabel(profile.role) : "No profile yet"}</small>
        </span>
      </div>
    </div>
  );
}

function PickerList({ title, items, selected, labelKey, onToggle }) {
  return (
    <fieldset className="pickerList">
      <legend>{title}</legend>
      {items.length === 0 && <span className="mutedLine">No records yet</span>}
      {items.map((item) => (
        <label key={item.id}>
          <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
          {item[labelKey]}
        </label>
      ))}
    </fieldset>
  );
}

function AppModal({ children, onClose, title, wide = false }) {
  return (
    <div className="modalBackdrop">
      <div className={wide ? "modal wideModal" : "modal"}>
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

function AuthGate({ authEmail = "", authMode = "signin", authPassword = "", loading = false, notice = "", onEmailChange, onModeChange, onPasswordChange, onSubmit }) {
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

function ResourceGroup({ title, count, icon: Icon, rows, onDropAssignment, onSelect }) {
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
        <div className="resourceRow" key={row.id}>
          <div className="resourceIdentity">
            {row.kind === "person" ? (
              <div className="avatar face">{row.avatar ?? makeInitials(row.full_name)}</div>
            ) : (
              <div className={`equipmentAvatar ${row.icon ?? "machine"}`}>{equipmentIcon(row.type)}</div>
            )}
            <div>
              <strong>{row.full_name}</strong>
              <span>{row.subtitle ?? roleLabel(row.role)}</span>
            </div>
          </div>

          <div
            className="rowTrack"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData("application/json");
              if (!raw) return;
              onDropAssignment?.({ assignment: JSON.parse(raw), row, clientX: event.clientX, trackElement: event.currentTarget });
            }}
          >
            {row.assignments.map((assignment) => (
              <ScheduleBlock assignment={assignment} key={assignment.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleBlock({ assignment, onSelect }) {
  const left = Math.max(0, ((assignment.start - 7) / 11) * 100);
  const width = Math.min(100 - left, ((assignment.end - assignment.start) / 11) * 100);

  return (
    <button
      className={`scheduleBlock ${assignment.color} ${assignment.status ?? ""}`}
      draggable={Boolean(assignment.visitId)}
      style={{ left: `${left}%`, width: `${width}%` }}
      type="button"
      onClick={() => onSelect(assignment)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/json", JSON.stringify(assignment));
      }}
    >
      <strong>{assignment.title}</strong>
      <span>{assignment.subtitle}</span>
      {assignment.timeText && <small>{assignment.timeText}</small>}
    </button>
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
