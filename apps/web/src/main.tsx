import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FoundationShell } from "@hooma/ui";
import { AuthApp } from "./auth/AuthApp";
import { AdminApp } from "./admin/AdminApp";
import { HomePage } from "./home/HomePage";
import { ProfilePage } from "./profile/ProfilePage";
import { TeamsPage } from "./teams/TeamsPage";
import { TeamDetailPage } from "./teams/TeamDetailPage";
import "./styles.css";
function WebApp() { const path = window.location.pathname; if (path.startsWith("/admin")) return <AdminApp />; if (path === "/login" || path === "/register") return <AuthApp />; if (path === "/profile") return <ProfilePage />; if (path === "/teams") return <TeamsPage />; const teamMatch = path.match(/^\/teams\/([^/]+)$/); if (teamMatch?.[1]) return <TeamDetailPage teamId={decodeURIComponent(teamMatch[1])} />; return <HomePage />; }
createRoot(document.getElementById("root")!).render(<StrictMode><FoundationShell surface="Web"><WebApp /></FoundationShell></StrictMode>);
