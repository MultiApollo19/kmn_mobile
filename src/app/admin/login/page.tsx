'use client';

import PinLoginForm from '@/src/components/PinLoginForm';
import AdminLoginForm from '@/src/components/AdminLoginForm';

export default function AdminLoginPage() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                <div className="hidden lg:block">
                    <AdminLoginForm />
                </div>

                <div className="block lg:hidden">
                    <PinLoginForm 
                        title="Panel administratora"
                        description="Wprowadź kod PIN administratora"
                        redirectPath="/admin"
                    />
                </div>
            </div>
        </div>
    );
}