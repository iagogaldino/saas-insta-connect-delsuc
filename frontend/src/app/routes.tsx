import { createBrowserRouter, Navigate } from "react-router-dom"
import { LoginPage } from "../pages/LoginPage"
import { DashboardPage } from "../pages/DashboardPage"
import { ConnectInstagramPage } from "../pages/ConnectInstagramPage"
import { ChatPage } from "../pages/ChatPage"
import { ConversasPage } from "../pages/ConversasPage"
import { DashboardLayout } from "../components/layout/DashboardLayout"
import { ProtectedRoute } from "../features/auth/protected-route"

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "connect-instagram", element: <ConnectInstagramPage /> },
      { path: "conversas", element: <ConversasPage /> },
      { path: "conversas/c/:threadId", element: <ChatPage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
