'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import PinLoginForm from '@/src/components/PinLoginForm';

export default function LoginPage() {
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="min-h-screen bg-background px-4 py-5 sm:py-6">
            <div className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-5xl grid-cols-1 place-items-center gap-4 lg:grid-cols-2 lg:gap-6">
                <div className="pointer-events-none absolute left-10 top-12 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
                <div className="pointer-events-none absolute bottom-12 right-10 h-52 w-52 rounded-full bg-secondary blur-3xl" />

                <section className="relative flex w-full items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
                    <div className="w-full max-w-sm text-center">
                        <div className="relative mx-auto -mt-3 h-48 w-96 max-w-full">
                            <Image
                                src="/Logo.png"
                                alt="Logo firmy"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>

                        <div className="mt-8 px-2 py-1">
                            <p className="text-base font-medium capitalize text-muted-foreground">
                                {currentTime.toLocaleDateString('pl-PL', {
                                    weekday: 'long',
                                    day: '2-digit',
                                    month: 'long',
                                    year: 'numeric'
                                })}
                            </p>
                            <p className="mt-1 text-5xl font-bold leading-none tracking-tight text-foreground tabular-nums">
                                {currentTime.toLocaleTimeString('pl-PL', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="relative flex w-full items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
                    <PinLoginForm showLogo={false} title="" />
                </section>
            </div>
        </div>
    );
}
