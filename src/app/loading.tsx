import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="h-full w-full flex items-center justify-center p-12">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
