import { lazy, Suspense } from "react";
import type { MeResponse } from "@hooma/contracts";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type { TelegramRuntime } from "../../telegram/runtime";
import { TelegramShell } from "../shell/TelegramShell";

const HomePage = lazy(() => import("../../home/HomePage").then((module) => ({ default: module.HomePage })));
const ProfilePage = lazy(() => import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const NotFoundPage = lazy(() => import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));

export function TelegramRouter({ runtime, me, error }: { readonly runtime: TelegramRuntime; readonly me: MeResponse | null; readonly error: string }) {
  return (
    <BrowserRouter>
      <TelegramShell runtime={runtime}>
        {error ? <p className="status">{error}</p> : null}
        <Suspense fallback={<p className="status">Loading…</p>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile" element={<ProfilePage me={me} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </TelegramShell>
    </BrowserRouter>
  );
}
