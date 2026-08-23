import { lazy, Suspense, useMemo } from "react";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { CheckInPage, CoachControlRoomPage, CreateEventPage, EventChatPage, EventDetailPage, FormationBuilderPage, HoomaFrontendProvider, PlayPage, TeamDetailPage, TeamsPage } from "@hooma/frontend";
import { WebAccountProvider } from "../../account/WebAccountProvider";
import { WebShell } from "../shell/WebShell";
const HomePage = lazy(() => import("../../home/HomePage").then((module) => ({ default: module.HomePage })));
const AuthApp = lazy(() => import("../../auth/AuthApp").then((module) => ({ default: module.AuthApp })));
const AdminApp = lazy(() => import("../../admin/AdminApp").then((module) => ({ default: module.AdminApp })));
const ProfilePage = lazy(() => import("../../profile/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const SettingsPage = lazy(() => import("../../settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const NotFoundPage = lazy(() => import("../../pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
function requiredParam(name: string, value: string | undefined): string { if (!value) throw new Error(`Missing route parameter ${name}`); return value; }
function TeamDetailRoute() { const { teamId } = useParams(); return <TeamDetailPage teamId={requiredParam("teamId", teamId)} />; }
function EventDetailRoute() { const { eventId } = useParams(); return <EventDetailPage eventId={requiredParam("eventId", eventId)} />; }
function EventFormationRoute() { const { eventId } = useParams(); return <FormationBuilderPage eventId={requiredParam("eventId", eventId)} />; }
function EventChatRoute() { const { eventId } = useParams(); return <EventChatPage eventId={requiredParam("eventId", eventId)} />; }
function EventCheckInRoute() { const { eventId } = useParams(); return <CheckInPage eventId={requiredParam("eventId", eventId)} />; }
function WebRoutes() { const transport = useMemo(() => ({ baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000", credentials: "include" as const, authenticationHref: (returnTo: string) => `/login?returnTo=${encodeURIComponent(returnTo)}`, onAuthenticationRequired: () => { window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}`; } }), []); return <HoomaFrontendProvider transport={transport}><WebAccountProvider><WebShell><Suspense fallback={<p className="status">Loading…</p>}><Routes><Route path="/" element={<HomePage />} /><Route path="/login" element={<AuthApp />} /><Route path="/register" element={<AuthApp />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/admin/*" element={<AdminApp />} /><Route path="/play" element={<PlayPage />} /><Route path="/events/new" element={<CreateEventPage />} /><Route path="/events/:eventId" element={<EventDetailRoute />} /><Route path="/events/:eventId/formation" element={<EventFormationRoute />} /><Route path="/events/:eventId/chat" element={<EventChatRoute />} /><Route path="/events/:eventId/check-in" element={<EventCheckInRoute />} /><Route path="/teams" element={<TeamsPage />} /><Route path="/teams/control" element={<CoachControlRoomPage />} /><Route path="/teams/:teamId" element={<TeamDetailRoute />} /><Route path="*" element={<NotFoundPage />} /></Routes></Suspense></WebShell></WebAccountProvider></HoomaFrontendProvider>; }
export function WebRouter() { return <BrowserRouter><WebRoutes /></BrowserRouter>; }
