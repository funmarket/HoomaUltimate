import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FoundationShell } from "@hooma/ui";
import { AuthApp } from "./auth/AuthApp";
import { AdminApp } from "./admin/AdminApp";
import { HomePage } from "./home/HomePage";
import { ProfilePage } from "./profile/ProfilePage";
import { TeamsPage } from "./teams/TeamsPage";
import { TeamDetailPage } from "./teams/TeamDetailPage";
import { CoachControlRoomPage } from "./teams/CoachControlRoomPage";
import { PlayPage } from "./events/PlayPage";
import { CreateEventPage } from "./events/CreateEventPage";
import { EventDetailPage } from "./events/EventDetailPage";
import { FormationBuilderPage } from "./events/FormationBuilderPage";
import { EventChatPage } from "./events/EventChatPage";
import { CheckInPage } from "./events/CheckInPage";
import "./styles.css";

function WebApp() {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return <AdminApp />;
  if (path === "/login" || path === "/register") return <AuthApp />;
  if (path === "/profile") return <ProfilePage />;
  if (path === "/play") return <PlayPage />;
  if (path === "/events/new") return <CreateEventPage />;
  const formationMatch = path.match(/^\/events\/([^/]+)\/formation$/);
  if (formationMatch?.[1]) return <FormationBuilderPage eventId={decodeURIComponent(formationMatch[1])} />;
  const chatMatch = path.match(/^\/events\/([^/]+)\/chat$/);
  if (chatMatch?.[1]) return <EventChatPage eventId={decodeURIComponent(chatMatch[1])} />;
  const checkInMatch = path.match(/^\/events\/([^/]+)\/check-in$/);
  if (checkInMatch?.[1]) return <CheckInPage eventId={decodeURIComponent(checkInMatch[1])} />;
  const eventMatch = path.match(/^\/events\/([^/]+)$/);
  if (eventMatch?.[1]) return <EventDetailPage eventId={decodeURIComponent(eventMatch[1])} />;
  if (path === "/teams") return <TeamsPage />;
  if (path === "/teams/control") return <CoachControlRoomPage />;
  const teamMatch = path.match(/^\/teams\/([^/]+)$/);
  if (teamMatch?.[1]) return <TeamDetailPage teamId={decodeURIComponent(teamMatch[1])} />;
  return <HomePage />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><FoundationShell surface="Web"><WebApp /></FoundationShell></StrictMode>);
