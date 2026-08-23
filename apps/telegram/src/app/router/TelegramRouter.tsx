import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { CheckInPage, CoachControlRoomPage, CreateEventPage, EventChatPage, EventDetailPage, FormationBuilderPage, HoomaFrontendProvider, PlayPage, TeamDetailPage, TeamsPage } from "@hooma/frontend";
import { TelegramAccountProvider, useTelegramAccount } from "../../account/TelegramAccountProvider";
import type { TelegramRuntime } from "../../telegram/runtime";
import { TelegramShell } from "../shell/TelegramShell";
const HomePage = lazy(() => import("../../home/HomePage").then((module) => ({ default: module.HomePage })));
const ProfilePage = lazy(() => import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import("../../settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const AdminPage = lazy(() => import("../../admin/AdminPage").then((module) => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
function requiredParam(name: string, value: string | undefined): string { if (!value) throw new Error(`Missing route parameter ${name}`); return value; }
function TeamDetailRoute() { const { teamId } = useParams(); return <TeamDetailPage teamId={requiredParam("teamId", teamId)} />; }
function EventDetailRoute() { const { eventId } = useParams(); return <EventDetailPage eventId={requiredParam("eventId", eventId)} />; }
function EventFormationRoute() { const { eventId } = useParams(); return <FormationBuilderPage eventId={requiredParam("eventId", eventId)} />; }
function EventChatRoute() { const { eventId } = useParams(); return <EventChatPage eventId={requiredParam("eventId", eventId)} />; }
function EventCheckInRoute() { const { eventId } = useParams(); return <CheckInPage eventId={requiredParam("eventId", eventId)} />; }
function TelegramProfileRoute() { const { me, refresh } = useTelegramAccount(); return <ProfilePage me={me} onRefresh={refresh} />; }
function TelegramRoutes({ runtime }: { readonly runtime: TelegramRuntime }) { const transport = useMemo(() => ({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000", getHeaders: () => ({ authorization: `tma ${runtime.initData}` }) }), [runtime.initData]); return <HoomaFrontendProvider transport={transport}><TelegramAccountProvider><TelegramShell runtime={runtime}><Suspense fallback={<p className="status">Loading…</p>}><Routes><Route path="/" element={<HomePage />} /><Route path="/profile" element={<TelegramProfileRoute />} /><Route path="/settings" element={<SettingsPage runtime={runtime} />} /><Route path="/admin" element={<AdminPage initData={runtime.initData} />} /><Route path="/play" element={<PlayPage />} /><Route path="/events/new" element={<CreateEventPage />} /><Route path="/events/:eventId" element={<EventDetailRoute />} /><Route path="/events/:eventId/formation" element={<EventFormationRoute />} /><Route path="/events/:eventId/chat" element={<EventChatRoute />} /><Route path="/events/:eventId/check-in" element={<EventCheckInRoute />} /><Route path="/teams" element={<TeamsPage />} /><Route path="/teams/control" element={<CoachControlRoomPage />} /><Route path="/teams/:teamId" element={<TeamDetailRoute />} /><Route path="*" element={<NotFoundPage />} /></Routes></Suspense></TelegramShell></TelegramAccountProvider></HoomaFrontendProvider>; }
export function TelegramRouter({ runtime }: { readonly runtime: TelegramRuntime }) { return <BrowserRouter><TelegramRoutes runtime={runtime} /></BrowserRouter>; }
