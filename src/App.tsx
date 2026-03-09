import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CourseManagement from "./pages/admin/CourseManagement";
import TodayStudy from "./pages/user/TodayStudy";
import LessonDetail from "./pages/user/LessonDetail";
import type { User } from "./types";

export type Page =
  | { name: "dashboard" }
  | { name: "admin-courses" }
  | { name: "today-study" }
  | { name: "lesson-detail"; recordId: number };

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>({ name: "dashboard" });

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

  // Reset to default page on login/logout
  const handleLogin = (u: User) => {
    setUser(u);
    setPage({ name: "dashboard" });
  };

  const handleLogout = () => {
    setUser(null);
    setPage({ name: "dashboard" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const renderPage = () => {
    switch (page.name) {
      case "admin-courses":
        return <CourseManagement onBack={() => setPage({ name: "dashboard" })} />;
      case "today-study":
        return (
          <TodayStudy
            onViewLesson={(recordId) => setPage({ name: "lesson-detail", recordId })}
          />
        );
      case "lesson-detail":
        return (
          <LessonDetail
            recordId={page.recordId}
            onBack={() => setPage({ name: "today-study" })}
          />
        );
      default:
        return <Dashboard user={user} onLogout={handleLogout} onNavigate={setPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <button
            onClick={() => setPage({ name: "dashboard" })}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-xl">🦌</span>
            <span className="font-bold text-gray-900 text-sm">Deer Duo</span>
          </button>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavButton
              active={page.name === "today-study" || page.name === "lesson-detail"}
              onClick={() => setPage({ name: "today-study" })}
            >
              今日学习
            </NavButton>
            {user.role === "admin" && (
              <NavButton
                active={page.name === "admin-courses"}
                onClick={() => setPage({ name: "admin-courses" })}
              >
                课程管理
              </NavButton>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">
              {user.username}
              {user.role === "admin" && (
                <span className="ml-1.5 bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded-full">
                  管理员
                </span>
              )}
            </span>
            <button
              onClick={async () => {
                await fetch("/api/logout", { method: "POST" });
                handleLogout();
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderPage()}
      </main>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-600"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

