import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ScreenSizeWarning from '../components/ScreenSizeWarning';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Rejestr interesantów',
    description: 'System zarządzania interesantami',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pl">
            <body className={`${inter.className} bg-background text-foreground antialiased`}>
                <ScreenSizeWarning />
                {children}
            </body>
        </html>
    );
}
