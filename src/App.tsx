import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CourseManagement from "./pages/admin/CourseManagement";
import ChapterEditor from "./pages/admin/ChapterEditor";
import TodayStudy from "./pages/user/TodayStudy";
import LessonDetail from "./pages/user/LessonDetail";
import { AppSidebar } from "./components/layout/AppSidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "./components/ui/sidebar";
import type { User } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const typed = data as { user: User } | null;
        if (typed?.user) setUser(typed.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <BrowserRouter>
      <SidebarProvider>
        <AppSidebar user={user} onLogout={() => setUser(null)} />
        <SidebarInset>
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger />
            <div className="h-4 w-px bg-border" />
            <h1 className="text-sm font-medium text-foreground">Deer Duo 学习工作台</h1>
          </header>

          {/* Page content */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/study" element={<TodayStudy />} />
              <Route path="/study/:recordId" element={<LessonDetail />} />
              {user.role === "admin" && (
                <>
                  <Route path="/admin/courses" element={<CourseManagement />} />
                  <Route path="/admin/courses/:courseId" element={<CourseManagement />} />
                  <Route path="/admin/courses/:courseId/chapters/new" element={<ChapterEditor />} />
                  <Route path="/admin/courses/:courseId/chapters/:chapterId" element={<ChapterEditor />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </BrowserRouter>
  );
}
