import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { CoachControlRoomPage, HoomaFrontendProvider, TeamDetailPage, TeamsPage } from "@hooma/frontend";
import { TelegramAccountProvider, useTelegramAccount } from "../../account/TelegramAccountProvider";
import type { TelegramRuntime } from "../../telegram/runtime";
import { TelegramShell } from "../shell/TelegramShell";

const HomePage = lazy(() => import("../../home/HomePage").then((module) => ({ default: module.HomePage })));
const ProfilePage = lazy(() => import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import("../../settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const AdminPage = lazy(() => import("../../admin/AdminPage").then((module) => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

function requiredParam(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing route parameter ${name}`);
  return value;
}

function TeamDetailRoute() {
  const { teamId } = useParams();
  return <TeamDetailPage teamId={requiredParam("teamId", teamId)} />;
}

function TelegramProfileRoute() {
  const { me } = useTelegramAccount();
  return <ProfilePage me={me} />;
}

function TelegramRoutes({ runtime }: { readonly runtime: TelegramRuntime }) {
  const transport = useMemo(
    () => ({
      baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
      getHeaders: () => ({ authorization: `tma ${runtime.initData}` })
    }),
    [runtime.initData]
  );

  return (
    <HoomaFrontendProvider transport={transport}>
      <TelegramAccountProvider>
        <TelegramShell runtime={runtime}>
          <Suspense fallback={<p className="status">Loading…</p>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/profile" element={<TelegramProfileRoute />} />
              <Route path="/settings" element={<SettingsPage runtime={runtime} />} />
              <Route path="/admin" element={<AdminPage initData={runtime.initData} />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/control" element={<CoachControlRoomPage />} />
              <Route path="/teams/:teamId" element={<TeamDetailRoute />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </TelegramShell>
      </TelegramAccountProvider>
    </HoomaFrontendProvider>
  );
}

export function TelegramRouter({ runtime }: { readonly runtime: TelegramRuntime }) {
  return <BrowserRouter><TelegramRoutes runtime={runtime} /></BrowserRouter>;
}
