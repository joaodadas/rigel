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
      className="relative opacity-0 border-0 shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_2px_8px_0_rgb(0_0_0/0.04),0_4px_16px_0_rgb(0_0_0/0.03)]"
      style={{
        animation: "kpi-enter 0.5s ease-out forwards",
        animationDelay: `${index * 100}ms`,
      }}
    >
      <CardContent className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
          <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 space-y-1">
          <p
            className="text-sm font-medium text-muted-foreground"
            style={{ textWrap: "balance" }}
          >
            {title}
          </p>
          <p
            className="text-2xl font-bold tracking-tight"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {value}
          </p>
          <p
            className={cn(
              "text-xs",
              trend === "up" && "text-emerald-600 dark:text-emerald-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
