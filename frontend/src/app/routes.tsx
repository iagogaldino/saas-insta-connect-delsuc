import { createBrowserRouter, Navigate } from "react-router-dom"
import { LoginPage } from "../pages/LoginPage"
import { DashboardPage } from "../pages/DashboardPage"
import { ConnectInstagramPage } from "../pages/ConnectInstagramPage"
import { ActiveSessionPage } from "../pages/ActiveSessionPage"
import { ChatPage } from "../pages/ChatPage"
import { ConversasPage } from "../pages/ConversasPage"
import { LandingPage } from "../pages/LandingPage"
import { DashboardLayout } from "../components/layout/DashboardLayout"
import { ProtectedRoute } from "../features/auth/protected-route"
import { InstaConnectProvider } from "../features/insta/insta-connect-provider"
import { appBasePath } from "../lib/config"

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/app",
    element: (
      <ProtectedRoute>
        <InstaConnectProvider>
          <DashboardLayout />
        </InstaConnectProvider>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "connect-instagram", element: <ConnectInstagramPage /> },
      { path: "instagram/session-active", element: <ActiveSessionPage /> },
      { path: "conversas", element: <ConversasPage /> },
      { path: "conversas/c/:threadId", element: <ChatPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
], {
  basename: appBasePath,
})
