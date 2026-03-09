import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { User } from "~/types";
import {
  CalendarCheck,
  BookOpen,
  Database,
  Cloud,
  Cpu,
  User as UserIcon,
} from "lucide-react";

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Welcome banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary to-primary/70 p-6 text-primary-foreground shadow-sm">
        <h2 className="text-xl font-bold mb-1">欢迎回来，{user.username}！</h2>
        <p className="text-primary-foreground/80 text-sm">今天也要好好学习哦 📚</p>
      </div>

      {/* Quick action cards */}
      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">快速入口</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            icon={<CalendarCheck className="size-6 text-blue-500" />}
            title="今日学习"
            description="查看和管理今天的课时与任务"
            onClick={() => navigate("/study")}
          />
          {user.role === "admin" && (
            <ActionCard
              icon={<BookOpen className="size-6 text-purple-500" />}
              title="课程管理"
              description="管理学科、章节和课时内容"
              onClick={() => navigate("/admin/courses")}
            />
          )}
          <StatCard
            icon={<UserIcon className="size-6 text-orange-500" />}
            label="当前用户"
            value={user.username}
            sub={
              user.role === "admin" ? (
                <Badge variant="secondary" className="text-xs">管理员账号</Badge>
              ) : (
                <span className="text-muted-foreground text-xs">普通账号</span>
              )
            }
          />
        </div>
      </section>

      {/* Tech stack info */}
      <Card>
        <CardHeader>
          <CardTitle>技术栈</CardTitle>
          <CardDescription>本项目使用的核心技术</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[
              { icon: <Cpu className="size-4 text-indigo-500" />, label: "后端", value: "Hono v4 on Cloudflare Workers" },
              { icon: <Cloud className="size-4 text-blue-500" />, label: "前端", value: "React 19 + Vite + shadcn/ui" },
              { icon: <Database className="size-4 text-green-500" />, label: "数据库", value: "Cloudflare D1 (SQLite)" },
              { icon: <BookOpen className="size-4 text-orange-500" />, label: "路由", value: "React Router v7" },
              { icon: <Cloud className="size-4 text-purple-500" />, label: "部署", value: "Cloudflare Pages + Workers" },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-3 text-sm">
                {item.icon}
                <span className="font-medium text-foreground min-w-[4rem]">{item.label}</span>
                <span className="text-muted-foreground">{item.value}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full"
    >
      <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer h-full">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 p-2 rounded-lg bg-muted">{icon}</div>
            <div>
              <p className="font-semibold text-foreground text-sm">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <div className="shrink-0 p-2 rounded-lg bg-muted">{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-base font-semibold text-foreground mt-0.5">{value}</p>
            <div className="mt-0.5">{sub}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
