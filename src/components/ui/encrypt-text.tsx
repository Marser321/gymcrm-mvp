"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const CHARS = "!<>-_\\\\/[]{}—=+*^?#________";

interface EncryptTextProps {
    text: string;
    className?: string;
    inView?: boolean;
}

export function EncryptText({ text, className, inView = true }: EncryptTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isRevealed, setIsRevealed] = useState(false);

    useEffect(() => {
        if (!inView) {
            setDisplayedText("");
            setIsRevealed(false);
            return;
        }

        if (isRevealed) return;

        let iteration = 0;
        const interval = setInterval(() => {
            setDisplayedText(
                text
                    .split("")
                    .map((letter, index) => {
                        if (index < iteration) {
                            return text[index];
                        }
                        return CHARS[Math.floor(Math.random() * CHARS.length)];
                    })
                    .join("")
            );

            if (iteration >= text.length) {
                clearInterval(interval);
                setIsRevealed(true);
            }

            iteration += 1 / 3;
        }, 30);

        return () => clearInterval(interval);
    }, [text, inView, isRevealed]);

    return (
        <motion.span
            className={className}
            initial={{ opacity: 0 }}
            animate={{ opacity: inView ? 1 : 0 }}
            transition={{ duration: 0.5 }}
        >
            {displayedText || text.replace(/./g, "—")}
        </motion.span>
    );
}
