import * as React from "react";
import { cn } from "@/lib/utils";

export interface CrystalCardProps extends React.HTMLAttributes<HTMLDivElement> {
    glow?: boolean;
}

export const CrystalCard = React.forwardRef<HTMLDivElement, CrystalCardProps>(
    ({ className, children, glow = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "glass-card rounded-3xl p-6 relative overflow-hidden group transition-all duration-500",
                    glow && "hover:bg-glow hover:border-primary/50",
                    className
                )}
                {...props}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative z-10">{children}</div>
            </div>
        );
    }
);
CrystalCard.displayName = "CrystalCard";
