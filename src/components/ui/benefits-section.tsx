"use client";

import { motion } from "framer-motion";
import { EncryptText } from "./encrypt-text";
import { Zap, Shield, TrendingUp, Users } from "lucide-react";
import { CrystalCard } from "./crystal-card";

// Bento Grid Layout
export function BenefitsSection() {
    return (
        <section id="benefits" className="relative w-full py-32 px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20 space-y-4">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
                        Diseñado para dueños que quieren <br className="hidden md:block" />
                        <EncryptText text="crecer sin límites." className="text-primary" />
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                        Olvídate de las hojas de Excel y los mensajes manuales.
                        Todo lo que necesitas para operar tu gimnasio en piloto automático.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[350px]">
                    {/* Item 1 - Large Wide */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="md:col-span-2"
                    >
                        <CrystalCard glow className="h-full flex flex-col justify-end p-8 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity group-hover:opacity-80" />
                            <div className="relative z-10 transition-transform duration-500 group-hover:-translate-y-2">
                                <div className="mb-4 bg-primary/20 p-3 rounded-2xl inline-block backdrop-blur-md border border-primary/30">
                                    <Zap className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-2 tracking-tight block">Cobranza Automática</h3>
                                <p className="text-gray-300 max-w-md text-lg">Deja de perseguir pagos por WhatsApp. Nosotros lo hacemos por ti con links de pago directos y recordatorios inteligentes.</p>
                            </div>
                        </CrystalCard>
                    </motion.div>

                    {/* Item 2 - Square */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="md:col-span-1"
                    >
                        <CrystalCard glow className="h-full flex flex-col justify-between p-8 bg-[#111]">
                            <div className="bg-orange-500/10 p-4 rounded-2xl w-fit border border-orange-500/20">
                                <Shield className="w-8 h-8 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Retención con IA</h3>
                                <p className="text-muted-foreground">Detectamos qué clientes están a punto de abandonar tu gym antes de que lo hagan, y los reenganchamos.</p>
                            </div>
                        </CrystalCard>
                    </motion.div>

                    {/* Item 3 - Square */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="md:col-span-1"
                    >
                        <CrystalCard glow className="h-full flex flex-col justify-between p-8 bg-[#111]">
                            <div className="bg-blue-500/10 p-4 rounded-2xl w-fit border border-blue-500/20">
                                <TrendingUp className="w-8 h-8 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground mb-2 tracking-tight">Escalabilidad Real</h3>
                                <p className="text-muted-foreground">Arquitectura multi-tenant sólida. Desde un local boutique hasta una franquicia nacional.</p>
                            </div>
                        </CrystalCard>
                    </motion.div>

                    {/* Item 4 - Large Wide */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="md:col-span-2"
                    >
                        <CrystalCard glow className="h-full flex flex-col justify-end p-8 bg-[url('https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=1470&auto=format&fit=crop')] bg-cover bg-center group relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity group-hover:opacity-80" />
                            <div className="relative z-10 transition-transform duration-500 group-hover:-translate-y-2">
                                <div className="mb-4 bg-pink-500/20 p-3 rounded-2xl inline-block backdrop-blur-md border border-pink-500/30">
                                    <Users className="w-8 h-8 text-pink-500" />
                                </div>
                                <h3 className="text-3xl font-bold text-white mb-2 tracking-tight">Comunidad y Reservas</h3>
                                <p className="text-gray-300 max-w-md text-lg">Clases y comunicación en un solo lugar. Una experiencia nativa móvil (WhatsApp First) que a tus atletas les encantará.</p>
                            </div>
                        </CrystalCard>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
