import type { User } from "../types";

type Page = { name: string };

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onNavigate: (page: Page) => void;
}

export default function Dashboard({ user, onLogout, onNavigate }: DashboardProps) {
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
    <div className="space-y-6">
      {/* Welcome card */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow">
        <h2 className="text-xl font-bold mb-1">欢迎回来，{user.username}！</h2>
        <p className="text-indigo-100 text-sm">今天也要好好学习哦 📚</p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          icon="📅"
          title="今日学习"
          description="查看和管理今天的课时与任务"
          onClick={() => onNavigate({ name: "today-study" })}
        />
        {user.role === "admin" && (
          <ActionCard
            icon="📖"
            title="课程管理"
            description="管理学科、章节和课时内容"
            onClick={() => onNavigate({ name: "admin-courses" })}
          />
        )}
        <StatCard
          icon="👤"
          label="当前用户"
          value={user.username}
          sub={user.role === "admin" ? "管理员账号" : "普通账号"}
        />
        <StatCard icon="🗄️" label="数据库" value="deer-duo" sub="Cloudflare D1" />
        <StatCard icon="☁️" label="部署平台" value="Cloudflare" sub="Pages + Workers" />
      </div>

      {/* Info section */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
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
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            <strong>AI：</strong>Cloudflare Workers AI
          </li>
        </ul>
      </div>

      {/* Logout for mobile */}
      <div className="sm:hidden">
        <button
          onClick={handleLogout}
          className="w-full text-sm text-gray-500 hover:text-red-600 transition-colors py-2"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4 text-left hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
    >
      <div className="text-3xl flex-shrink-0">{icon}</div>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </button>
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
