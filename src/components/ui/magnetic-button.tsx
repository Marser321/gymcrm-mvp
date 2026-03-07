"use client";

import React, { useRef, useState } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagneticButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode;
}

export const MagneticButton = React.forwardRef<HTMLButtonElement, MagneticButtonProps>(
    ({ className, children, ...props }, ref) => {
        const defaultRef = useRef<HTMLButtonElement>(null);
        const resolvedRef = (ref as React.MutableRefObject<HTMLButtonElement>) || defaultRef;

        const [position, setPosition] = useState({ x: 0, y: 0 });

        const handleMouse = (e: React.MouseEvent<HTMLButtonElement>) => {
            const { clientX, clientY } = e;
            const { height, width, left, top } = resolvedRef.current!.getBoundingClientRect();
            const middleX = clientX - (left + width / 2);
            const middleY = clientY - (top + height / 2);
            setPosition({ x: middleX * 0.15, y: middleY * 0.15 });
        };

        const reset = () => {
            setPosition({ x: 0, y: 0 });
        };

        const { x, y } = position;
        return (
            <motion.button
                ref={resolvedRef}
                onMouseMove={handleMouse}
                onMouseLeave={reset}
                animate={{ x, y }}
                transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
                className={cn(
                    "relative inline-flex items-center justify-center px-8 py-4 overflow-hidden font-medium text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors shadow-[0_0_30px_var(--theme-glow)]",
                    className
                )}
                {...props}
            >
                <span className="relative z-10">{children}</span>
                {/* Subtle inner glow effect */}
                <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none mix-blend-overlay" />
            </motion.button>
        );
    }
);
MagneticButton.displayName = "MagneticButton";
