import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  index?: number;
}

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  trend = "neutral",
  index = 0,
}: KpiCardProps) {
  return (
    <Card
      className="relative opacity-0 border border-border/50 shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_2px_8px_0_rgb(0_0_0/0.04)]"
      style={{
        animation: "kpi-enter 0.5s ease-out forwards",
        animationDelay: `${index * 80}ms`,
      }}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div>
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </p>
          <p
            className={cn(
              "text-xs mt-1",
              trend === "up" && "text-emerald-600 dark:text-emerald-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              trend === "neutral" && "text-muted-foreground/70"
            )}
          >
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
