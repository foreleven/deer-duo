import type { User } from "../types";

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/logout", { method: "POST" });
      if (!response.ok) {
        console.error("Logout request failed with status:", response.status);
      }
    } catch (error) {
      console.error("Logout request encountered an error:", error);
    } finally {
      onLogout();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦌</span>
            <span className="text-lg font-bold text-gray-900">Deer Duo</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              欢迎，
              <span className="font-medium text-indigo-600">{user.username}</span>
              {user.role === "admin" && (
                <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  管理员
                </span>
              )}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Welcome card */}
          <div className="col-span-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow">
            <h2 className="text-xl font-bold mb-1">仪表盘</h2>
            <p className="text-indigo-100 text-sm">
              你好，{user.username}！欢迎回到 Deer Duo 管理后台。
            </p>
          </div>

          {/* Stats cards */}
          <StatCard
            icon="👤"
            label="当前用户"
            value={user.username}
            sub={user.role === "admin" ? "管理员账号" : "普通账号"}
          />
          <StatCard
            icon="🗄️"
            label="数据库"
            value="deer-duo"
            sub="Cloudflare D1"
          />
          <StatCard
            icon="☁️"
            label="部署平台"
            value="Cloudflare"
            sub="Pages + Workers"
          />
        </div>

        {/* Info section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">技术栈</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              <strong>后端：</strong>Hono v4 on Cloudflare Workers
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <strong>前端：</strong>React 19 + Vite
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
              <strong>样式：</strong>Tailwind CSS v4
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              <strong>数据库：</strong>Cloudflare D1 (SQLite)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              <strong>认证：</strong>JWT (httpOnly cookie)
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4">
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-lg font-semibold text-gray-900 mt-0.5">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
