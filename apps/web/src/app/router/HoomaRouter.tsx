import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import {
  CheckInPage,
  CoachControlRoomPage,
  CreateEventPage,
  CreateHoomaPage,
  CreateTeamPage,
  EventChatPage,
  EventDetailPage,
  FormationBuilderPage,
  GamerGamePage,
  GamersPage,
  HoomaDetailPage,
  HoomaEditPage,
  HoomaFrontendProvider,
  HoomaPage,
  PitchPage,
  PlacesPage,
  PlayPage,
  TeamDetailPage,
  TeamEditPage,
  TeamLineupPage,
  TeamsPage,
  WatchPage,
} from "@hooma/frontend";
import { AccountProvider } from "../../account/AccountProvider";
import { createTelegramRuntime } from "../../telegram/runtime";
import { HoomaShell } from "../shell/HoomaShell";

const HomePage = lazy(() =>
  import("../../home/HomePage").then((module) => ({ default: module.HomePage })),
);
const AuthApp = lazy(() =>
  import("../../auth/AuthApp").then((module) => ({ default: module.AuthApp })),
);
const TelegramAccountActivationPage = lazy(() =>
  import("../../auth/TelegramAccountActivationPage").then((module) => ({
    default: module.TelegramAccountActivationPage,
  })),
);
const AdminApp = lazy(() =>
  import("../../admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);
const ProfilePage = lazy(() =>
  import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })),
);
const PublicProfilePage = lazy(() =>
  import("../../profile/PublicProfilePage").then((module) => ({
    default: module.PublicProfilePage,
  })),
);
const SettingsPage = lazy(() =>
  import("../../settings/SettingsPage").then((module) => ({ default: module.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
);

function requiredParam(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing route parameter ${name}`);
  return value;
}

function PublicProfileRoute() {
  const { username } = useParams();
  return <PublicProfilePage username={requiredParam("username", username)} />;
}

function TeamDetailRoute() {
  const { teamId } = useParams();
  return <TeamDetailPage teamId={requiredParam("teamId", teamId)} />;
}

function TeamEditRoute() {
  const { teamId } = useParams();
  return <TeamEditPage teamId={requiredParam("teamId", teamId)} />;
}

function TeamLineupRoute() {
  const { teamId } = useParams();
  return <TeamLineupPage teamId={requiredParam("teamId", teamId)} />;
}

function HoomaDetailRoute() {
  const { communityId } = useParams();
  return <HoomaDetailPage communityId={requiredParam("communityId", communityId)} />;
}

function HoomaEditRoute() {
  const { communityId } = useParams();
  return <HoomaEditPage communityId={requiredParam("communityId", communityId)} />;
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

function GamerGameRoute() {
  const { gameSlug } = useParams();
  return <GamerGamePage gameSlug={requiredParam("gameSlug", gameSlug)} />;
}

function apiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
  }
  return "";
}

function HoomaRoutes() {
  const runtime = useMemo(() => createTelegramRuntime(), []);
  const transport = useMemo(() => {
    const actionAccountHref = (returnTo: string) =>
      runtime.initData
        ? `/account/create?returnTo=${encodeURIComponent(returnTo)}`
        : `/register?returnTo=${encodeURIComponent(returnTo)}`;

    return {
      baseUrl: apiBaseUrl(),
      credentials: "include" as const,
      getHeaders: () => (runtime.initData ? { authorization: `tma ${runtime.initData}` } : {}),
      authenticationHref: actionAccountHref,
      onAuthenticationRequired: () => {
        window.location.href = actionAccountHref(
          window.location.pathname + window.location.search + window.location.hash,
        );
      },
    };
  }, [runtime.initData]);
  const accountEntry = runtime.initData ? <TelegramAccountActivationPage /> : <AuthApp />;

  return (
    <HoomaFrontendProvider transport={transport}>
      <AccountProvider>
        <HoomaShell runtime={runtime}>
          <Suspense fallback={<p className="status">Loading…</p>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/telegram" element={<HomePage />} />
              <Route path="/login" element={accountEntry} />
              <Route path="/register" element={accountEntry} />
              <Route path="/account/create" element={<TelegramAccountActivationPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:username" element={<PublicProfileRoute />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin/*" element={<AdminApp />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/watch" element={<WatchPage />} />
              <Route path="/pitch" element={<PitchPage />} />
              <Route path="/places" element={<PlacesPage />} />
              <Route path="/events/new" element={<CreateEventPage />} />
              <Route path="/events/:eventId" element={<EventDetailRoute />} />
              <Route path="/events/:eventId/formation" element={<EventFormationRoute />} />
              <Route path="/events/:eventId/chat" element={<EventChatRoute />} />
              <Route path="/events/:eventId/check-in" element={<EventCheckInRoute />} />
              <Route path="/hooma" element={<HoomaPage />} />
              <Route path="/hooma/new" element={<CreateHoomaPage />} />
              <Route path="/hooma/:communityId/edit" element={<HoomaEditRoute />} />
              <Route path="/hooma/:communityId" element={<HoomaDetailRoute />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/new" element={<CreateTeamPage />} />
              <Route path="/teams/control" element={<CoachControlRoomPage />} />
              <Route path="/teams/:teamId/edit" element={<TeamEditRoute />} />
              <Route path="/teams/:teamId/lineup" element={<TeamLineupRoute />} />
              <Route path="/teams/:teamId" element={<TeamDetailRoute />} />
              <Route path="/gamers" element={<GamersPage />} />
              <Route path="/gamers/games/:gameSlug" element={<GamerGameRoute />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </HoomaShell>
      </AccountProvider>
    </HoomaFrontendProvider>
  );
}

export function HoomaRouter() {
  return (
    <BrowserRouter>
      <HoomaRoutes />
    </BrowserRouter>
  );
}
