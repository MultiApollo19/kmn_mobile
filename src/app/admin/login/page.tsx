'use client';

import PinLoginForm from '@/src/components/PinLoginForm';

export default function AdminLoginPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <PinLoginForm 
                title="Panel Administratora"
                description="Wprowadź kod PIN administratora"
                redirectPath="/admin"
            />
        </div>
    );
}