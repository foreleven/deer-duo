import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "~/components/ui/sidebar";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import type { User } from "~/types";
import {
  LayoutDashboard,
  BookOpen,
  CalendarCheck,
  LogOut,
} from "lucide-react";

interface AppSidebarProps {
  user: User;
  onLogout: () => void;
}

export function AppSidebar({ user, onLogout }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const mainNav = [
    {
      label: "仪表盘",
      icon: LayoutDashboard,
      path: "/dashboard",
    },
    {
      label: "今日学习",
      icon: CalendarCheck,
      path: "/study",
    },
  ];

  const adminNav = [
    {
      label: "课程管理",
      icon: BookOpen,
      path: "/admin/courses",
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      onLogout();
    }
  };

  return (
    <Sidebar>
      {/* Logo / Brand */}
      <SidebarHeader>
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors w-full"
        >
          <span className="text-2xl">🦌</span>
          <span className="font-bold text-sidebar-foreground text-base">Deer Duo</span>
        </button>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Main Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.path}
                      onClick={() => navigate(item.path)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User info + logout */}
      <SidebarSeparator />
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar size="sm">
            <AvatarFallback>
              {user.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.username}
            </p>
            {user.role === "admin" && (
              <Badge variant="secondary" className="text-xs h-4 mt-0.5">
                管理员
              </Badge>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="退出登录"
            className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
