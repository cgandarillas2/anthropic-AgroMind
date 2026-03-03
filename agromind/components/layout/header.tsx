import { UserButton } from "@clerk/nextjs";
import { BellRing } from "lucide-react";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

async function getUnreadAlertsCount(userId: string) {
  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: {
      farms: {
        select: {
          _count: {
            select: { alerts: { where: { isRead: false } } },
          },
        },
      },
    },
  });

  return (
    user?.farms.reduce(
      (sum, farm) => sum + farm._count.alerts,
      0
    ) ?? 0
  );
}

export async function Header() {
  const { userId } = await auth();
  const unreadCount = userId ? await getUnreadAlertsCount(userId) : 0;

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0">
      <div className="text-sm text-gray-500">
        Maule Region — Curicó
      </div>

      <div className="flex items-center gap-4">
        {/* Botón de alertas */}
        <Link
          href="/alerts"
          className="relative p-2 rounded-md hover:bg-gray-50 transition-colors"
        >
          <BellRing className="w-5 h-5 text-gray-500" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Link>

        {/* Avatar Clerk */}
        <UserButton afterSignOutUrl="/sign-in" />
      </div>
    </header>
  );
}
