import { lazy, Suspense } from "react";
import type { MeResponse } from "@hooma/contracts";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { TelegramManagedTeam } from "../../api/client";
import type { TelegramRuntime } from "../../telegram/runtime";
import { TelegramShell } from "../shell/TelegramShell";

const HomePage = lazy(() => import("../../home/HomePage").then((module) => ({ default: module.HomePage })));
const ProfilePage = lazy(() => import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import("../../settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const AdminPage = lazy(() => import("../../admin/AdminPage").then((module) => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

export function TelegramRouter({
  runtime,
  me,
  managedTeams,
  error
}: {
  readonly runtime: TelegramRuntime;
  readonly me: MeResponse | null;
  readonly managedTeams: readonly TelegramManagedTeam[];
  readonly error: string;
}) {
  return (
    <BrowserRouter>
      <TelegramShell runtime={runtime} me={me} managedTeams={managedTeams}>
        {error ? <p className="status">{error}</p> : null}
        <Suspense fallback={<p className="status">Loading…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage me={me} />} />
            <Route path="/settings" element={<SettingsPage runtime={runtime} />} />
            <Route path="/admin" element={<AdminPage initData={runtime.initData} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </TelegramShell>
    </BrowserRouter>
  );
}
