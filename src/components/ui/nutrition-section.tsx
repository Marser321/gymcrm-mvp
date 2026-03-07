"use client";

import { motion } from "framer-motion";
import { CrystalCard } from "./crystal-card";

export function NutritionSection() {
    return (
        <section id="nutrition" className="relative w-full py-32 px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                {/* Visual Tracker */}
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-square flex flex-col items-center justify-center p-4 lg:p-12"
                >
                    <div className="absolute inset-0 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

                    <CrystalCard className="w-full max-w-md mx-auto p-6 md:p-8 relative z-10 shadow-2xl border-white/10 bg-[#111]">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-bold text-foreground">Nutrición de Hoy</h3>
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                🍳
                            </div>
                        </div>

                        {/* Calories ring mockup */}
                        <div className="flex justify-center mb-10">
                            <div className="relative w-48 h-48 rounded-full border-[12px] border-white/5 flex items-center justify-center overflow-hidden">
                                <svg className="absolute inset-0 w-full h-full -rotate-90">
                                    <circle
                                        cx="50%"
                                        cy="50%"
                                        r="40%"
                                        className="stroke-primary drop-shadow-[0_0_8px_var(--theme-glow)]"
                                        strokeWidth="12"
                                        fill="none"
                                        strokeDasharray="250"
                                        strokeDashoffset="75"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="text-center z-10">
                                    <span className="text-4xl font-bold text-foreground block">1,850</span>
                                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Kcal</span>
                                </div>
                            </div>
                        </div>

                        {/* Macros */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                <span className="text-xs font-semibold text-blue-400 block mb-1">PRO</span>
                                <span className="text-xl font-bold text-foreground">160g</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                <span className="text-xs font-semibold text-orange-400 block mb-1">CARB</span>
                                <span className="text-xl font-bold text-foreground">220g</span>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/5">
                                <span className="text-xs font-semibold text-pink-400 block mb-1">FAT</span>
                                <span className="text-xl font-bold text-foreground">65g</span>
                            </div>
                        </div>
                    </CrystalCard>
                </motion.div>

                {/* Content */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="flex flex-col items-start"
                >
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6">
                        No es solo entrenar. <br />
                        Es <span className="text-glow text-primary">nutrir los resultados.</span>
                    </h2>

                    <p className="text-xl text-muted-foreground mb-8 leading-relaxed font-light">
                        El paquete ultra-premium no estaría completo sin un seguimiento de macros avanzado. Dele a sus clientes la capacidad de registrar comidas, calorías y metas diarias directamente desde su App personalizada.
                    </p>

                    <div className="space-y-6 w-full">
                        <div className="flex bg-white/5 p-4 rounded-2xl border border-white/5 gap-4 items-center">
                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-xl shrink-0">
                                🥗
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground text-lg">Comunidad de Recetas</h4>
                                <p className="text-muted-foreground text-sm">Los usuarios pueden compartir macros y comidas entre ellos.</p>
                            </div>
                        </div>
                        <div className="flex bg-white/5 p-4 rounded-2xl border border-white/5 gap-4 items-center">
                            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-xl shrink-0">
                                ⚖️
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground text-lg">Metas Personalizables</h4>
                                <p className="text-muted-foreground text-sm">Asigna objetivos dietéticos automáticos basados en las metas de fitness.</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
