import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Home,
  ImagePlus,
  LogIn,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Truck,
  UserRound,
  UsersRound,
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

const timeLabels = ["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM"];

const assignments = [
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
  if (type === "Truck") return "TR";
  if (type === "Lift") return "LF";
  if (type === "Skid Steer") return "SS";
  return "EX";
}

function samplePhoto() {
  return getProjectPhoto("Site photo");
}

export default function App() {
  const [activeNav, setActiveNav] = useState("schedule");
  const [scheduleMode, setScheduleMode] = useState("day");
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [data, setData] = useState(demo);
  const [selectedProjectId, setSelectedProjectId] = useState("project-1");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("a1");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [notice, setNotice] = useState("");
  const [showAnnotator, setShowAnnotator] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data: authData }) => setSession(authData.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase || !session) return;

    async function loadData() {
      const [projectsResult, peopleResult, equipmentResult] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("is_active", true).order("full_name"),
        supabase.from("equipment").select("*").order("name"),
      ]);

      const hasError = [projectsResult, peopleResult, equipmentResult].find((result) => result.error);
      if (hasError) {
        setNotice(hasError.error.message);
        return;
      }

      setData({
        companyId: peopleResult.data[0]?.company_id ?? demo.companyId,
        projects: projectsResult.data.length ? projectsResult.data : demo.projects,
        people: peopleResult.data.length ? peopleResult.data : demo.people,
        equipment: equipmentResult.data.length ? equipmentResult.data : demo.equipment,
        files: demo.files,
      });
    }

    loadData();
  }, [session]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      if (supabase && session) {
        const { data: results, error } = await supabase.rpc("global_search", { search_query: query });
        if (!error) {
          setSearchResults(results);
          return;
        }
      }

      setSearchResults(localGlobalSearch({ ...data, visits: assignments }, query));
    }, 160);

    return () => window.clearTimeout(handle);
  }, [data, searchQuery, session]);

  const selectedProject = data.projects.find((project) => project.id === selectedProjectId) ?? data.projects[0];
  const selectedAssignment = assignments.find((item) => item.id === selectedAssignmentId) ?? assignments[0];

  const peopleRows = data.people.map((person) => ({
    ...person,
    kind: "person",
    subtitle: person.trade,
    assignments: assignments.filter((item) => item.type === "person" && item.resourceId === person.id),
  }));

  const equipmentRows = data.equipment.map((equipment) => ({
    ...equipment,
    kind: "equipment",
    full_name: equipment.name,
    subtitle: equipment.type,
    assignments: assignments.filter((item) => item.type === "equipment" && item.resourceId === equipment.id),
  }));

  const currentVisit = {
    id: selectedAssignment.id,
    project_id: selectedProject.id,
  };

  async function signIn(event) {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    setNotice(error?.message ?? "");
  }

  function selectAssignment(assignment) {
    setSelectedAssignmentId(assignment.id);
    setSelectedProjectId(assignment.projectId);
  }

  function renderSearchIcon(result) {
    if (result.type === "file" && result.file_kind === "pdf") return <FileText className="pdfIcon" size={18} />;
    if (result.type === "file" && result.file_kind === "excel") return <FileSpreadsheet className="excelIcon" size={18} />;
    if (result.type === "project") return <FolderKanban size={18} />;
    if (result.type === "person") return <UsersRound size={18} />;
    if (result.type === "equipment") return <Truck size={18} />;
    return <Calendar size={18} />;
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
              <button
                className={activeNav === item.id ? "sideNavItem active" : "sideNavItem"}
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebarUser">
          <div className="avatar face">JC</div>
          <div>
            <strong>James Carter</strong>
            <span>Project Manager</span>
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
              <input
                placeholder="Search..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {searchResults.length > 0 && (
                <div className="searchResults">
                  {searchResults.map((result) => (
                    <button className="searchResult" key={result.id} type="button">
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

            <button className="iconButton soft" type="button" title="Notifications">
              <Bell size={20} />
            </button>

            {isSupabaseConfigured && !session ? (
              <form className="quickLogin" onSubmit={signIn}>
                <input placeholder="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                <input placeholder="password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                <button type="submit" title="Sign in">
                  <LogIn size={17} />
                </button>
              </form>
            ) : (
              <div className="avatar face small">JC</div>
            )}
          </div>
        </header>

        <section className="contentGrid">
          <section className="scheduleArea">
            <div className="modeTabs">
              {["day", "week", "month"].map((mode) => (
                <button
                  className={scheduleMode === mode ? "modeTab active" : "modeTab"}
                  key={mode}
                  type="button"
                  onClick={() => setScheduleMode(mode)}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <div className="calendarToolbar">
              <div className="dateStepper">
                <button type="button" title="Previous day">
                  <ChevronLeft size={19} />
                </button>
                <button type="button" title="Next day" disabled>
                  <ChevronRight size={19} />
                </button>
              </div>

              <button className="dateButton" type="button">
                <Calendar size={18} />
                Wednesday, May 15, 2024
              </button>

              <div className="toolbarSpacer" />

              <button className="outlineButton" type="button">
                Today
              </button>
              <button className="squareButton" type="button" title="Open calendar">
                <Calendar size={18} />
              </button>
              <button className="addButton" type="button">
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

              <ResourceGroup title="People" count={peopleRows.length} icon={UsersRound} rows={peopleRows} onSelect={selectAssignment} />
              <ResourceGroup title="Equipment" count={equipmentRows.length} icon={Truck} rows={equipmentRows} onSelect={selectAssignment} />
            </div>
          </section>

          <aside className="projectPanel">
            <div className="projectImageWrap">
              <img src={getProjectPhoto(selectedProject.name)} alt="" />
              <span className="projectStatusBadge">{selectedProject.status}</span>
              <button className="imageMenu" type="button" title="More">
                <MoreHorizontal size={20} />
              </button>
            </div>

            <div className="projectTitleBlock">
              <h2>{selectedProject.name}</h2>
              <p>{selectedProject.category ?? "Construction Project"}</p>
            </div>

            <dl className="projectFacts">
              <ProjectFact icon={UserRound} label="Client" value={selectedProject.contact_name} />
              <ProjectFact icon={UsersRound} label="Project Manager" value={selectedProject.project_manager ?? "James Carter"} />
              <ProjectFact icon={Calendar} label="Start Date" value={selectedProject.start_date ?? "Mar 1, 2024"} />
              <ProjectFact icon={Calendar} label="End Date" value={selectedProject.end_date ?? "Nov 30, 2024"} />
              <ProjectFact icon={CircleGauge} label="Status" value={selectedProject.status} badge />
              <div className="projectFact">
                <Settings size={18} />
                <dt>Progress</dt>
                <dd>
                  <strong>{selectedProject.progress ?? 62}%</strong>
                  <span className="progressTrack">
                    <span style={{ width: `${selectedProject.progress ?? 62}%` }} />
                  </span>
                </dd>
              </div>
            </dl>

            <div className="descriptionBlock">
              <h3>Project Description</h3>
              <p>{selectedProject.description}</p>
            </div>

            <div className="panelActions">
              <DocumentUploader
                companyId={data.companyId}
                projectId={selectedProject.id}
                visitId={currentVisit.id}
                onUploaded={setNotice}
              />

              <button className="photoAction" type="button" onClick={() => setShowAnnotator(true)}>
                <ImagePlus size={18} />
                Mark up photo
              </button>
            </div>

            <button className="viewProjectButton" type="button">
              View Project
              <ChevronRight size={20} />
            </button>
          </aside>
        </section>

        {showAnnotator && (
          <div className="modalBackdrop">
            <div className="modal">
              <div className="modalHeader">
                <h2>Visit photo markup</h2>
                <button className="outlineButton" type="button" onClick={() => setShowAnnotator(false)}>
                  Close
                </button>
              </div>
              <PhotoAnnotator
                imageUrl={samplePhoto()}
                onSave={async ({ dataUrl, annotationJson }) => {
                  try {
                    if (supabase && session) {
                      await uploadAnnotatedVisitPhoto({
                        companyId: data.companyId,
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
            </div>
          </div>
        )}
      </main>
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
              <div className="avatar face">{row.avatar ?? row.full_name?.slice(0, 2)}</div>
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
  const left = ((assignment.start - 7) / 11) * 100;
  const width = ((assignment.end - assignment.start) / 11) * 100;

  return (
    <button
      className={`scheduleBlock ${assignment.color}`}
      style={{ left: `${left}%`, width: `${width}%` }}
      type="button"
      onClick={() => onSelect(assignment)}
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
