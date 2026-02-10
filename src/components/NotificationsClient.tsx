"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2 } from 'lucide-react';
import { createActorClient } from '@/src/lib/supabaseActor';
import { useAuth } from '@/src/hooks/useAuth';
import { cn } from '@/src/lib/utils';

type EventLog = {
	id: number;
	created_at: string;
	event_type: string;
	level: string;
	action: string | null;
	actor_name: string | null;
	resource_type: string | null;
	resource_id: string | null;
	source: string | null;
	context: Record<string, unknown> | null;
};

const friendlyEventNames: Record<string, string> = {
	'auth.pin.verify': 'Weryfikacja PIN',
	'auth.login': 'Logowanie',
	'auth.logout': 'Wylogowanie',
	'auth.failed': 'Nieudane logowanie',
	'auth.expired': 'Wygaśnięcie sesji',
	'visit.entry': 'Wejście wizyty',
	'visit.exit': 'Wyjście wizyty',
	'visit.auto_exit': 'Auto-wyjście (system)',
	'visit.update': 'Aktualizacja wizyty',
	'visit.delete': 'Usunięcie wizyty',
	'admin.employee.create': 'Dodanie pracownika',
	'admin.employee.update': 'Edycja pracownika',
	'admin.employee.delete': 'Usunięcie pracownika',
	'admin.employee.pin_update': 'Zmiana PIN pracownika',
	'admin.department.create': 'Dodanie działu',
	'admin.department.update': 'Edycja działu',
	'admin.department.delete': 'Usunięcie działu',
	'admin.purpose.create': 'Dodanie celu wizyty',
	'admin.purpose.update': 'Edycja celu wizyty',
	'admin.purpose.delete': 'Usunięcie celu wizyty',
	'admin.badge.create': 'Dodanie identyfikatora',
	'admin.badge.update': 'Edycja identyfikatora',
	'admin.badge.delete': 'Usunięcie identyfikatora',
	'admin.badge.toggle': 'Zmiana statusu identyfikatora'
};

function getEventLabel(eventType: string) {
	return friendlyEventNames[eventType] || eventType;
}

function formatShortDate(iso: string) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleString('pl-PL', {
		hour: '2-digit',
		minute: '2-digit',
		day: '2-digit',
		month: '2-digit'
	});
}

function getLevelBadge(level: string) {
	switch (level) {
		case 'error':
			return 'bg-rose-100 text-rose-700';
		case 'warn':
			return 'bg-amber-100 text-amber-700';
		case 'info':
			return 'bg-blue-100 text-blue-700';
		case 'audit':
			return 'bg-emerald-100 text-emerald-700';
		default:
			return 'bg-muted text-muted-foreground';
	}
}

export default function NotificationsClient() {
	const { user } = useAuth();
	const [isOpen, setIsOpen] = useState(false);
	const [items, setItems] = useState<EventLog[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [alertCount, setAlertCount] = useState(0);
	const wrapperRef = useRef<HTMLDivElement | null>(null);

	const sinceIso = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);

	const fetchAlerts = useCallback(async () => {
		if (!user) return;
		const client = createActorClient(user);

		try {
			const { count, error: countError } = await client
				.from('event_logs')
				.select('id', { count: 'exact', head: true })
				.gte('created_at', sinceIso)
				.in('level', ['warn', 'error']);

			if (countError) throw countError;
			setAlertCount(count ?? 0);
		} catch {
			setAlertCount(0);
		}
	}, [sinceIso, user]);

	const fetchItems = useCallback(async () => {
		if (!user) return;
		setLoading(true);
		setError(null);
		const client = createActorClient(user);

		try {
			const { data, error: queryError } = await client
				.from('event_logs')
				.select('*')
				.order('created_at', { ascending: false })
				.limit(8);

			if (queryError) throw queryError;
			setItems((data || []) as EventLog[]);
		} catch {
			setError('Nie udało się pobrać zdarzeń.');
			setItems([]);
		} finally {
			setLoading(false);
		}
	}, [user]);

	useEffect(() => {
		void fetchAlerts();
		const interval = window.setInterval(fetchAlerts, 60 * 1000);
		return () => window.clearInterval(interval);
	}, [fetchAlerts]);

	useEffect(() => {
		if (!isOpen) return;
		void fetchItems();
	}, [fetchItems, isOpen]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (!wrapperRef.current) return;
			if (!wrapperRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen]);

	return (
		<div className="relative" ref={wrapperRef}>
			<button
				type="button"
				className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors relative"
				aria-label="Powiadomienia"
				aria-expanded={isOpen}
				onClick={() => setIsOpen((prev) => !prev)}
			>
				<Bell className="w-5 h-5" />
				{alertCount > 0 && (
					<span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold flex items-center justify-center border-2 border-card px-1">
						{alertCount > 9 ? '9+' : alertCount}
					</span>
				)}
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-card shadow-lg z-30 overflow-hidden">
					<div className="px-4 py-3 border-b border-border flex items-center justify-between">
						<div className="text-sm font-semibold">Ostatnie zdarzenia</div>
						<Link
							href="/admin/logs"
							className="text-xs text-muted-foreground hover:text-foreground"
							onClick={() => setIsOpen(false)}
						>
							Zobacz wszystkie
						</Link>
					</div>

					<div className="max-h-96 overflow-y-auto">
						{loading && (
							<div className="px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="w-4 h-4 animate-spin" />
								Ładowanie...
							</div>
						)}
						{!loading && error && (
							<div className="px-4 py-6 text-sm text-destructive">{error}</div>
						)}
						{!loading && !error && items.length === 0 && (
							<div className="px-4 py-6 text-sm text-muted-foreground">Brak zdarzeń do wyświetlenia.</div>
						)}
						{!loading && !error && items.map((item) => (
							<div key={item.id} className="px-4 py-3 border-b border-border last:border-b-0">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="text-sm font-medium text-foreground truncate">
											{getEventLabel(item.event_type)}
										</div>
										<div className="text-xs text-muted-foreground mt-1 truncate">
											{item.actor_name || 'System'} · {formatShortDate(item.created_at)}
										</div>
									</div>
									<span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', getLevelBadge(item.level))}>
										{item.level}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
