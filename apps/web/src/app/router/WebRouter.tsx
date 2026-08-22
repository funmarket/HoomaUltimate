import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { WebAccountProvider } from "../../account/WebAccountProvider";
import { WebShell } from "../shell/WebShell";

const HomePage = lazy(() => import("../../home/HomePage").then((module) => ({ default: module.HomePage })));
const AuthApp = lazy(() => import("../../auth/AuthApp").then((module) => ({ default: module.AuthApp })));
const AdminApp = lazy(() => import("../../admin/AdminApp").then((module) => ({ default: module.AdminApp })));
const ProfilePage = lazy(() => import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import("../../settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const TeamsPage = lazy(() => import("../../teams/TeamsPage").then((module) => ({ default: module.TeamsPage })));
const TeamDetailPage = lazy(() => import("../../teams/TeamDetailPage").then((module) => ({ default: module.TeamDetailPage })));
const CoachControlRoomPage = lazy(() => import("../../teams/CoachControlRoomPage").then((module) => ({ default: module.CoachControlRoomPage })));
const PlayPage = lazy(() => import("../../events/PlayPage").then((module) => ({ default: module.PlayPage })));
const CreateEventPage = lazy(() => import("../../events/CreateEventPage").then((module) => ({ default: module.CreateEventPage })));
const EventDetailPage = lazy(() => import("../../events/EventDetailPage").then((module) => ({ default: module.EventDetailPage })));
const FormationBuilderPage = lazy(() => import("../../events/FormationBuilderPage").then((module) => ({ default: module.FormationBuilderPage })));
const EventChatPage = lazy(() => import("../../events/EventChatPage").then((module) => ({ default: module.EventChatPage })));
const CheckInPage = lazy(() => import("../../events/CheckInPage").then((module) => ({ default: module.CheckInPage })));
const NotFoundPage = lazy(() => import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

function requiredParam(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing route parameter ${name}`);
  return value;
}

function TeamDetailRoute() {
  const { teamId } = useParams();
  return <TeamDetailPage teamId={requiredParam("teamId", teamId)} />;
}

function EventDetailRoute() {
  const { eventId } = useParams();
  return <EventDetailPage eventId={requiredParam("eventId", eventId)} />;
}

function EventFormationRoute() {
  const { eventId } = useParams();
  return <FormationBuilderPage eventId={requiredParam("eventId", eventId)} />;
}

function EventChatRoute() {
  const { eventId } = useParams();
  return <EventChatPage eventId={requiredParam("eventId", eventId)} />;
}

function EventCheckInRoute() {
  const { eventId } = useParams();
  return <CheckInPage eventId={requiredParam("eventId", eventId)} />;
}

export function WebRouter() {
  return (
    <BrowserRouter>
      <WebAccountProvider>
        <WebShell>
          <Suspense fallback={<p className="status">Loading…</p>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<AuthApp />} />
              <Route path="/register" element={<AuthApp />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/events/new" element={<CreateEventPage />} />
              <Route path="/events/:eventId" element={<EventDetailRoute />} />
              <Route path="/events/:eventId/formation" element={<EventFormationRoute />} />
              <Route path="/events/:eventId/chat" element={<EventChatRoute />} />
              <Route path="/events/:eventId/check-in" element={<EventCheckInRoute />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/control" element={<CoachControlRoomPage />} />
              <Route path="/teams/:teamId" element={<TeamDetailRoute />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </WebShell>
      </WebAccountProvider>
    </BrowserRouter>
  );
}
