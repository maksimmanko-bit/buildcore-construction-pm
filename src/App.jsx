import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  ClipboardCheck,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Home,
  ImagePlus,
  LogIn,
  LogOut,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Settings,
  Truck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import DocumentUploader from "./components/DocumentUploader.jsx";
import PhotoAnnotator from "./components/PhotoAnnotator.jsx";
import { isSupabaseConfigured, supabase } from "./lib/supabase.js";
import { uploadAnnotatedVisitPhoto } from "./lib/storage.js";
import { localGlobalSearch } from "./lib/search.js";

const demo = {
  companyId: "00000000-0000-0000-0000-000000000001",
  projects: [
    {
      id: "project-1",
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
const timeLabels = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM"];
const colors = ["blue", "green", "yellow", "purple", "orange"];

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

function getProjectPhoto(projectName) {
  const title = encodeURIComponent(projectName);
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

function FormField({ label, children }) {
  return (
    <label className="formField">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState("schedule");
  const [scheduleMode, setScheduleMode] = useState("day");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState({ ...demo, visits: [] });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedProjectId, setSelectedProjectId] = useState("project-1");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("a1");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [companyForm, setCompanyForm] = useState({ company_name: "BuildCore Construction", full_name: "", phone: "" });
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [visitForm, setVisitForm] = useState(emptyVisitForm);

  const isLive = Boolean(session && profile);
  const canManage = ["owner", "project_manager", "office_manager"].includes(profile?.role);
  const currentUserName = profile?.full_name || session?.user?.email || "James Carter";

  const refreshData = useCallback(async () => {
    if (!supabase || !session) return;
    setLoading(true);
    setNotice("");

    try {
      const profileResult = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (profileResult.error) throw profileResult.error;

      if (!profileResult.data) {
        setProfile(null);
        setData({ ...demo, visits: [] });
        setModalType("onboarding");
        return;
      }

      setProfile(profileResult.data);

      const [projectsResult, peopleResult, equipmentResult, visitsResult] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
        supabase.from("equipment").select("*").order("name"),
        supabase.from("visit_schedule_view").select("*").eq("visit_date", selectedDate).order("start_time"),
      ]);

      const failed = [projectsResult, peopleResult, equipmentResult, visitsResult].find((result) => result.error);
      if (failed) throw failed.error;

      const nextProjects = projectsResult.data ?? [];
      setData({
        companyId: profileResult.data.company_id,
        projects: nextProjects,
        people: peopleResult.data ?? [],
        equipment: equipmentResult.data ?? [],
        visits: visitsResult.data ?? [],
        files: demo.files,
      });

      if (nextProjects.length && !nextProjects.some((project) => project.id === selectedProjectId)) {
        setSelectedProjectId(nextProjects[0].id);
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedProjectId, session]);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setShowAuth(!authData.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setShowAuth(!nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshData();
  }, [refreshData, session]);

  const projectLookup = useMemo(() => new Map(data.projects.map((project, index) => [project.id, { ...project, color: colors[index % colors.length] }])), [data.projects]);

  const liveAssignments = useMemo(() => {
    if (!isLive) return demoAssignments;

    return (data.visits ?? []).flatMap((visit) => {
      const project = projectLookup.get(visit.project_id);
      const base = {
        visitId: visit.id,
        projectId: visit.project_id,
        title: project?.name ?? "Project visit",
        subtitle: visit.work_scope || normalizeStatus(visit.status),
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
  }, [data.visits, isLive, projectLookup]);

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

  const rowsSource = isLive ? data : demo;
  const assignmentsSource = isLive ? liveAssignments : demoAssignments;
  const selectedProject = rowsSource.projects.find((project) => project.id === selectedProjectId) ?? rowsSource.projects[0] ?? demo.projects[0];
  const selectedAssignment = assignmentsSource.find((item) => item.id === selectedAssignmentId) ?? assignmentsSource[0];
  const currentVisit = {
    id: selectedAssignment?.visitId ?? selectedAssignment?.id ?? "demo-visit",
    project_id: selectedProject.id,
  };

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
    const action =
      authMode === "signup"
        ? supabase.auth.signUp({ email: authEmail, password: authPassword })
        : supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    const { error } = await action;
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice(authMode === "signup" ? "Account created. Check email confirmation if Supabase asks for it." : "");
    setShowAuth(false);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
    setData({ ...demo, visits: [] });
    setSelectedProjectId("project-1");
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
    const { data: inserted, error } = await supabase
      .from("projects")
      .insert({
        ...projectForm,
        company_id: profile.company_id,
        created_by: profile.id,
      })
      .select()
      .single();
    setLoading(false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setProjectForm(emptyProjectForm);
    setModalType(null);
    setSelectedProjectId(inserted.id);
    setNotice("Project saved.");
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
    const { data: visit, error: visitError } = await supabase
      .from("visits")
      .insert({
        company_id: profile.company_id,
        project_id: visitForm.project_id,
        visit_date: visitForm.visit_date,
        start_time: visitForm.start_time,
        end_time: visitForm.end_time,
        is_first_visit: visitForm.is_first_visit,
        work_scope: visitForm.work_scope,
        created_by: profile.id,
      })
      .select()
      .single();

    if (visitError) {
      setLoading(false);
      setNotice(visitError.message);
      return;
    }

    const peopleRowsToInsert = visitForm.people_ids.map((profileId) => ({ visit_id: visit.id, profile_id: profileId }));
    const equipmentRowsToInsert = visitForm.equipment_ids.map((equipmentId) => ({ visit_id: visit.id, equipment_id: equipmentId }));

    const peopleResult = peopleRowsToInsert.length ? await supabase.from("visit_people").insert(peopleRowsToInsert) : { error: null };
    const equipmentResult = equipmentRowsToInsert.length ? await supabase.from("visit_equipment").insert(equipmentRowsToInsert) : { error: null };
    const error = peopleResult.error || equipmentResult.error;

    if (error) {
      await supabase.from("visits").delete().eq("id", visit.id);
      setLoading(false);
      setNotice(error.message);
      return;
    }

    setLoading(false);
    setVisitForm({ ...emptyVisitForm, visit_date: selectedDate, project_id: rowsSource.projects[0]?.id ?? "" });
    setModalType(null);
    setSelectedDate(visit.visit_date);
    setSelectedProjectId(visit.project_id);
    setNotice("Visit scheduled. Conflict checks passed.");
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
    if (!supabase || !selectedAssignment?.visitId) {
      setNotice("Sign in and select a live visit first.");
      return;
    }

    const patch =
      status === "on_site"
        ? { status, arrived_at: new Date().toISOString() }
        : { status, completed_at: new Date().toISOString() };
    const { error } = await supabase.from("visits").update(patch).eq("id", selectedAssignment.visitId);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotice(status === "on_site" ? "Visit is in progress. Upload Safety Form and first-visit photos." : "Visit completed. Add photos and office notes.");
    refreshData();
  }

  function openAddModal() {
    if (!session) {
      setShowAuth(true);
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

    if (activeNav === "projects") setModalType("project");
    else if (activeNav === "equipment") setModalType("equipment");
    else if (activeNav === "people") setModalType("people");
    else {
      setVisitForm({
        ...emptyVisitForm,
        visit_date: selectedDate,
        project_id: rowsSource.projects[0]?.id ?? "",
      });
      setModalType("visit");
    }
  }

  function selectAssignment(assignment) {
    setSelectedAssignmentId(assignment.id);
    setSelectedProjectId(assignment.projectId);
  }

  function handleSearchSelect(result) {
    setSearchQuery("");
    setSearchResults([]);
    if (result.type === "project") {
      setSelectedProjectId(result.id.replace("project-", ""));
      setActiveNav("projects");
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

  function renderMainContent() {
    if (activeNav === "projects") {
      return (
        <>
          <SectionToolbar label="Projects" onAdd={openAddModal} />
          <ProjectsView projects={rowsSource.projects} onSelect={(project) => setSelectedProjectId(project.id)} />
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
      return <InfoView icon={FileText} title="Documents" text="Project PDFs and Excel files are stored in Supabase Storage. Search reads extracted file text when documents are uploaded." />;
    }
    if (activeNav === "reports") {
      return <InfoView icon={FileBarChart2} title="Reports" text="Reports will use the same project, people, equipment, visit, and document records already connected here." />;
    }
    if (activeNav === "settings") {
      return <SettingsView profile={profile} session={session} isConfigured={isSupabaseConfigured} />;
    }
    if (activeNav === "overview") {
      return <OverviewView data={rowsSource} assignments={assignmentsSource} isLive={isLive} />;
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
        onSelect={selectAssignment}
      />
    );
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
            <div className="globalSearch">
              <Search size={18} />
              <input placeholder="Search..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />

              {searchResults.length > 0 && (
                <div className="searchResults">
                  {searchResults.map((result) => (
                    <button className="searchResult" key={result.id} type="button" onClick={() => handleSearchSelect(result)}>
                      <span className="searchIcon">{renderSearchIcon(result)}</span>
                      <span>
                        <strong>{result.title}</strong>
                        <small>{result.subtitle}</small>
                        <em>{result.snippet}</em>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button className="iconButton soft" type="button" title="Notifications" onClick={() => setNotice("No new notifications.")}>
              <Bell size={20} />
            </button>

            {isSupabaseConfigured && session ? (
              <button className="sessionButton" type="button" onClick={signOut}>
                <LogOut size={17} />
                Sign out
              </button>
            ) : (
              <button className="sessionButton" type="button" onClick={() => setShowAuth(true)}>
                <LogIn size={17} />
                Sign in
              </button>
            )}

            <div className="avatar face small">{makeInitials(currentUserName)}</div>
          </div>
        </header>

        <section className="contentGrid">
          <section className="scheduleArea">
            {loading && <div className="loadingBar" />}
            {!isSupabaseConfigured && <div className="emptyState">Add Supabase variables to connect the app.</div>}
            {isSupabaseConfigured && session && !profile && <div className="emptyState">Create your company profile to start using live data.</div>}
            {renderMainContent()}
          </section>

          <aside className="projectPanel">
            <div className="projectImageWrap">
              <img src={getProjectPhoto(selectedProject.name)} alt="" />
              <span className="projectStatusBadge">{normalizeStatus(selectedProject.status)}</span>
              <button className="imageMenu" type="button" title="More" onClick={() => setNotice(selectedProject.address)}>
                <MoreHorizontal size={20} />
              </button>
            </div>

            <div className="projectTitleBlock">
              <h2>{selectedProject.name}</h2>
              <p>{selectedProject.category ?? "Construction Project"}</p>
            </div>

            <dl className="projectFacts">
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

            <div className="visitActions">
              <button type="button" onClick={() => updateVisitStatus("on_site")}>
                <ClipboardCheck size={18} />
                Arrived
              </button>
              <button type="button" onClick={() => updateVisitStatus("completed")}>
                <CheckCircle2 size={18} />
                Complete
              </button>
            </div>

            <div className="panelActions">
              <DocumentUploader companyId={rowsSource.companyId} projectId={selectedProject.id} visitId={currentVisit.id} onUploaded={setNotice} />

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
        </section>

        {showAuth && (
          <AppModal title={authMode === "signup" ? "Create account" : "Sign in"} onClose={() => setShowAuth(false)}>
            <form className="stackForm" onSubmit={signIn}>
              <FormField label="Email">
                <input required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
              </FormField>
              <FormField label="Password">
                <input required minLength={6} type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
              </FormField>
              <div className="formActions">
                <button className="outlineButton" type="button" onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}>
                  {authMode === "signup" ? "I have account" : "Create account"}
                </button>
                <button className="addButton" type="submit" disabled={loading}>
                  <LogIn size={18} />
                  Continue
                </button>
              </div>
            </form>
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
                <button className="addButton" type="submit" disabled={loading}>
                  <Save size={18} />
                  Save company
                </button>
              </div>
            </form>
          </AppModal>
        )}

        {modalType === "project" && (
          <AppModal title="Add project" onClose={() => setModalType(null)}>
            <form className="stackForm twoColumns" onSubmit={saveProject}>
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
                  Save project
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
          <AppModal title="Schedule visit" onClose={() => setModalType(null)}>
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
                  Save visit
                </button>
              </div>
            </form>
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

        {showAnnotator && (
          <AppModal title="Visit photo markup" onClose={() => setShowAnnotator(false)} wide>
            <PhotoAnnotator
              imageUrl={samplePhoto()}
              onSave={async ({ dataUrl, annotationJson }) => {
                try {
                  if (supabase && session && profile) {
                    await uploadAnnotatedVisitPhoto({
                      companyId: rowsSource.companyId,
                      projectId: selectedProject.id,
                      visitId: currentVisit.id,
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
          </AppModal>
        )}
      </main>
    </div>
  );
}

function ScheduleView({ assignmentsReady, equipmentRows, peopleRows, scheduleMode, selectedDate, setScheduleMode, setSelectedDate, onAdd, onSelect }) {
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

        <ResourceGroup title="People" count={peopleRows.length} icon={UsersRound} rows={peopleRows} onSelect={onSelect} />
        <ResourceGroup title="Equipment" count={equipmentRows.length} icon={Truck} rows={equipmentRows} onSelect={onSelect} />
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

function ProjectsView({ projects, onSelect }) {
  return (
    <div className="listView">
      {projects.length === 0 && <div className="emptyState">No projects yet. Press Add to create the first project.</div>}
      {projects.map((project) => (
        <button className="listRow" type="button" key={project.id} onClick={() => onSelect(project)}>
          <FolderKanban size={20} />
          <span>
            <strong>{project.name}</strong>
            <small>{project.address}</small>
          </span>
          <em>{normalizeStatus(project.status)}</em>
        </button>
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

function OverviewView({ data, assignments, isLive }) {
  return (
    <div className="overviewGrid">
      <MetricCard label="Projects" value={data.projects.length} />
      <MetricCard label="People" value={data.people.length} />
      <MetricCard label="Equipment" value={data.equipment.length} />
      <MetricCard label="Today visits" value={assignments.filter((item) => item.type === "person").length} />
      {!isLive && <div className="emptyState wide">Demo preview is visible until you sign in.</div>}
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

function ResourceGroup({ title, count, icon: Icon, rows, onSelect }) {
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

          <div className="rowTrack">
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
    <button className={`scheduleBlock ${assignment.color} ${assignment.status ?? ""}`} style={{ left: `${left}%`, width: `${width}%` }} type="button" onClick={() => onSelect(assignment)}>
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
