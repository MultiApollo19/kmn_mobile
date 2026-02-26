'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import PinLoginForm from '@/src/components/PinLoginForm';

export default function LoginPage() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const currentTime = now.toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const currentDate = now.toLocaleDateString('pl-PL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <main className="min-h-screen bg-background px-4 py-6 sm:px-8 lg:px-12">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-7xl grid-cols-1 lg:grid-cols-2 lg:gap-12">
                <section className="flex flex-col justify-center p-4 text-center lg:p-6">
                    <div className="mx-auto w-full max-w-md space-y-6">
                        <div className="relative mx-auto h-32 w-full sm:h-36 lg:h-40">
                            <Image
                                src="/Logo.png"
                                alt="Logo KMN"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>

                        <div className="space-y-2">
                            <p className="text-3xl font-medium tracking-tight text-foreground/80 sm:text-4xl lg:text-5xl">
                                {currentTime}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize sm:text-base">
                                {currentDate}
                            </p>
                        </div>
                    </div>
                </section>

                <section className="flex flex-col items-center justify-center p-4 sm:p-6 lg:items-end lg:p-6">
                    <div className="mb-6 w-full max-w-md text-center">
                        <h1 className="text-3xl font-bold tracking-tight">Witaj</h1>
                        <p className="mt-2 text-base text-muted-foreground">Wprowadź swój kod PIN, aby kontynuować</p>
                    </div>

                    <div className="w-full max-w-md">
                        <PinLoginForm
                            showHeader={false}
                            className="max-w-md min-h-0 p-0"
                        />
                    </div>
                </section>
            </div>
        </main>
    );
}
