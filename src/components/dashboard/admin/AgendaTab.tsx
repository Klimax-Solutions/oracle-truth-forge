import { useMemo, useState, useCallback, useEffect } from 'react';
import { normalizeSearchText, matchesSearch } from '@/lib/admin/searchUtils';
import { getSetterColor } from '@/lib/admin/setterColors';
import { format } from '@/lib/admin/dateFormatting';
import {
  isToday,
  isSameDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar,
  RefreshCw,
  Clock,
  UserX,
  AlertCircle,
  Sparkles,
  UserCheck,
  Search,
  CheckCircle2,
  X as XIcon,
} from 'lucide-react';
import PeriodSelector, { type PeriodMode } from './PeriodSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CRMLead, CALL_OUTCOME_STYLES, mapRowToCRMLead } from '@/lib/admin/types';
import LeadDetailModal from './LeadDetailModal';

// ============================================
// Types — CRMLead imported from @/lib/admin/types
// ============================================

function getCallStatusColor(lead: CRMLead): string {
  if (lead.call_no_show) return 'noshow';
  if (lead.call_rescheduled_at) return 'amber';
  if (!lead.call_done && lead.call_scheduled_at && new Date(lead.call_scheduled_at) > new Date()) return 'blue';
  if (lead.call_outcome === 'contracted') return 'violet';
  if (lead.call_outcome === 'closing_in_progress') return 'amber';
  if (lead.call_outcome === 'not_closed') return 'red';
  if (lead.call_done) return 'gray';
  return 'blue';
}

// ============================================
// Component
// ============================================

export default function AgendaTab() {
  const { toast } = useToast();

  // Data
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<PeriodMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [search, setSearch] = useState('');
  const [setterFilter, setSetterFilter] = useState('all');
  const [closerFilter, setCloserFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('early_access_requests')
        .select('*')
        .eq('call_booked', true)
        .not('call_scheduled_at', 'is', null)
        .order('call_scheduled_at', { ascending: true });

      if (error) throw error;
      setLeads((data || []).map(r => mapRowToCRMLead(r)));
    } catch (err) {
      console.error('AgendaTab fetch error:', err);
      toast({ title: 'Erreur', description: 'Impossible de charger les RDV', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLeads();

    // Realtime subscription
    const channel = supabase
      .channel('agenda-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'early_access_requests' }, () => fetchLeads())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'early_access_requests' }, () => fetchLeads())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  // ============================================
  // Period Navigation
  // ============================================

  const goToPrevious = useCallback(() => {
    setCurrentDate(d => {
      if (viewMode === 'day') return subDays(d, 1);
      if (viewMode === 'week') return subWeeks(d, 1);
      return subMonths(d, 1);
    });
  }, [viewMode]);

  const goToNext = useCallback(() => {
    setCurrentDate(d => {
      if (viewMode === 'day') return addDays(d, 1);
      if (viewMode === 'week') return addWeeks(d, 1);
      return addMonths(d, 1);
    });
  }, [viewMode]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const periodLabel = useMemo(() => {
    if (viewMode === 'day') return format(currentDate, 'EEEE d MMMM', { locale: fr });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd MMM', { locale: fr })} - ${format(end, 'd MMM', { locale: fr })}`;
    }
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy', { locale: fr });
    return 'Tous les RDV';
  }, [currentDate, viewMode]);

  const periodLabelShort = useMemo(() => {
    if (viewMode === 'day') return format(currentDate, 'EEE d MMM', { locale: fr });
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd', { locale: fr })}-${format(end, 'd MMM', { locale: fr })}`;
    }
    if (viewMode === 'month') return format(currentDate, 'MMM yyyy', { locale: fr });
    return 'Total';
  }, [currentDate, viewMode]);

  // ============================================
  // Filtering
  // ============================================

  const filteredLeads = useMemo(() => {
    let filtered = leads;

    // Period filter
    if (viewMode !== 'all') {
      filtered = filtered.filter(l => {
        if (!l.call_scheduled_at) return false;
        const d = new Date(l.call_scheduled_at);
        if (viewMode === 'day') return isSameDay(d, currentDate);
        if (viewMode === 'week') {
          const start = startOfWeek(currentDate, { weekStartsOn: 1 });
          const end = endOfWeek(currentDate, { weekStartsOn: 1 });
          return d >= start && d <= end;
        }
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);
        return d >= start && d <= end;
      });
    }

    // Search
    if (search.trim()) {
      filtered = filtered.filter(l => matchesSearch(search, l.first_name, l.email, l.phone));
    }

    // Setter filter
    if (setterFilter !== 'all') {
      filtered = filtered.filter(l => l.setter_name === setterFilter);
    }

    // Closer filter
    if (closerFilter !== 'all') {
      filtered = filtered.filter(l => l.closer_name === closerFilter);
    }

    return filtered;
  }, [leads, viewMode, currentDate, search, setterFilter, closerFilter]);

  // Unique setters/closers for filters
  const settersList = useMemo(() => [...new Set(leads.map(l => l.setter_name).filter(Boolean))].sort() as string[], [leads]);
  const closersList = useMemo(() => [...new Set(leads.map(l => l.closer_name).filter(Boolean))].sort() as string[], [leads]);

  // ============================================
  // Stats
  // ============================================

  const stats = useMemo(() => {
    const now = new Date();
    const total = filteredLeads.length;
    const completed = filteredLeads.filter(l => l.call_done || (l.call_scheduled_at && new Date(l.call_scheduled_at) < now)).length;
    const remaining = total - completed;
    const noShows = filteredLeads.filter(l => l.call_no_show).length;
    const contracted = filteredLeads.filter(l => l.call_outcome === 'contracted').length;
    const closing = filteredLeads.filter(l => l.call_outcome === 'closing_in_progress').length;
    return { total, completed, remaining, noShows, contracted, closing };
  }, [filteredLeads]);

  // ============================================
  // Week view days
  // ============================================

  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate, viewMode]);

  const getLeadsForDate = useCallback((date: Date) => {
    return filteredLeads.filter(l => l.call_scheduled_at && isSameDay(new Date(l.call_scheduled_at), date));
  }, [filteredLeads]);

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-center justify-between">
          {/* Desktop Title */}
          <div className="hidden md:flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-white font-display text-2xl tracking-wide">Agenda</h2>
          </div>

          {/* Mobile: Stats + Refresh */}
          <div className="flex md:hidden items-center gap-2 flex-1">
            <button
              onClick={fetchLeads}
              disabled={loading}
              className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Calendar className="w-3 h-3 text-blue-400" />
                <span className="text-sm font-display text-blue-400">{stats.total}</span>
              </div>
              {stats.noShows > 0 && (
                <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <UserX className="w-3 h-3 text-red-400" />
                  <span className="text-sm font-medium text-red-400">{stats.noShows}</span>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Stats */}
          <div className="hidden md:flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Calendar className="w-3 h-3 text-blue-400" />
              <span className="text-xs font-display text-blue-400 font-bold">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.10]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400/70" />
              <span className="text-[11px] font-mono text-emerald-400/80">{stats.completed}</span>
              <span className="text-[10px] text-white/20">/</span>
              <Clock className="w-3 h-3 text-white/30" />
              <span className="text-[11px] font-mono text-white/40">{stats.remaining}</span>
            </div>
            {stats.contracted > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span className="text-[11px] font-display text-violet-400">{stats.contracted}</span>
              </div>
            )}
            {stats.closing > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span className="text-[11px] font-display text-amber-400">{stats.closing}</span>
              </div>
            )}
            {stats.noShows > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/20">
                <UserX className="w-3 h-3 text-red-400" />
                <span className="text-[11px] font-display text-red-400">{stats.noShows}</span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 md:gap-3 justify-between md:justify-end flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className={`h-9 pl-8 pr-7 rounded-xl text-sm font-display bg-white/[0.04] border transition-all outline-none placeholder:text-white/30
                ${search
                  ? 'w-48 md:w-56 border-blue-500/30 text-blue-300 bg-blue-500/[0.08]'
                  : 'w-32 md:w-44 border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12] focus:w-48 md:focus:w-56 focus:border-blue-500/30'
                }`}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Closer Filter */}
          {closersList.length > 0 && (
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className={`hidden md:flex w-44 h-9 px-3 rounded-xl font-display text-sm transition-all ${
                closerFilter !== 'all'
                  ? 'bg-gradient-to-r from-violet-500/20 to-violet-600/10 border border-violet-500/30 text-violet-300 shadow-lg shadow-violet-500/10'
                  : 'bg-white/[0.04] border border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12]'
              }`}>
                <UserCheck className="w-3.5 h-3.5 mr-2 shrink-0" />
                <SelectValue placeholder="Tous closers" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl">
                <SelectItem value="all" className="text-white/70 focus:bg-white/10 focus:text-white font-display text-sm">Tous les closers</SelectItem>
                {closersList.map(c => (
                  <SelectItem key={c} value={c} className="text-white/80 focus:bg-violet-500/20 focus:text-violet-200 font-display text-sm">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Setter Filter */}
          {settersList.length > 0 && (() => {
            const activeColor = setterFilter !== 'all' ? getSetterColor(setterFilter) : null;
            return (
              <Select value={setterFilter} onValueChange={setSetterFilter}>
                <SelectTrigger className={`hidden md:flex w-44 h-9 px-3 rounded-xl font-display text-sm transition-all ${
                  activeColor
                    ? `${activeColor.filterGradient} ${activeColor.border} ${activeColor.text} shadow-lg ${activeColor.shadow}`
                    : 'bg-white/[0.04] border border-white/[0.08] text-white/80 hover:bg-white/[0.06] hover:border-white/[0.12]'
                }`}>
                  <Search className={`w-3.5 h-3.5 mr-2 shrink-0 ${activeColor ? activeColor.icon : 'text-white/40'}`} />
                  <SelectValue placeholder="Tous setters" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl">
                  <SelectItem value="all" className="text-white/70 focus:bg-white/10 focus:text-white font-display text-sm">Tous les setters</SelectItem>
                  {settersList.map(s => {
                    const sc = getSetterColor(s);
                    return <SelectItem key={s} value={s} className={`${sc.text} font-display text-sm`}>{s}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            );
          })()}

          <PeriodSelector
            mode={viewMode}
            setMode={setViewMode}
            periodLabel={periodLabel}
            periodLabelShort={periodLabelShort}
            onPrevious={goToPrevious}
            onNext={goToNext}
            onToday={goToToday}
            isAtToday={isToday(currentDate)}
            allowFuture={true}
          />

          {/* Refresh — Desktop */}
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="hidden md:flex w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.08] items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="hidden md:flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[10px] text-white/30">
        <div className="flex items-center gap-3">
          <span className="text-white/20 uppercase tracking-wider">Issues:</span>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-500" /><span>Contracte</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /><span>En cours</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span>Not closed</span></div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-white/20" /><span>En attente</span></div>
        </div>
        <div className="w-px h-3 bg-white/10" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded border border-dashed border-red-500/60 bg-red-600/20" /><span>No-show</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded border border-amber-500/40 bg-amber-500/15" /><span>Replanifie</span></div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-white/50 text-sm">Chargement des rendez-vous...</p>
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar className="w-12 h-12 text-white/20 mb-4" />
          <h3 className="text-white/70 font-medium mb-2">Aucun rendez-vous</h3>
          <p className="text-white/40 text-sm">Aucun call planifie pour cette periode.</p>
        </div>
      ) : viewMode === 'week' ? (
        /* =============== WEEK VIEW — Time Grid (spike-launch style) =============== */
        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#0d0e14]">
          {/* Header Row with days */}
          <div className="grid border-b border-white/[0.1] bg-gradient-to-r from-white/[0.03] to-transparent" style={{ gridTemplateColumns: '70px repeat(7, 1fr)' }}>
            <div className="p-3 border-r border-white/[0.08] flex items-center justify-center">
              <span className="text-white/25 text-[10px] font-display uppercase tracking-[0.15em]">Heure</span>
            </div>
            {weekDays.map(day => {
              const today = isToday(day);
              const dayLeads = getLeadsForDate(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`p-3 text-center border-r border-white/[0.10] last:border-r-0 transition-all ${
                    today ? 'bg-gradient-to-b from-blue-500/15 to-blue-500/5 border-b-2 border-b-blue-500/50' : ''
                  }`}
                >
                  <div className={`text-[10px] font-display uppercase tracking-[0.2em] ${today ? 'text-blue-400' : 'text-white/40'}`}>
                    {format(day, 'EEE', { locale: fr })}
                  </div>
                  <div className={`text-2xl font-display font-semibold mt-0.5 ${today ? 'text-blue-400' : 'text-white/70'}`}>
                    {format(day, 'd')}
                  </div>
                  {dayLeads.length > 0 && (
                    <div className={`text-[10px] font-mono mt-1 ${today ? 'text-blue-400/70' : 'text-white/30'}`}>
                      {dayLeads.length} call{dayLeads.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Grid */}
          <div className="relative">
            {Array.from({ length: 13 }, (_, i) => i + 8).map(hour => (
              <div key={hour} className="grid border-b border-white/[0.05] group" style={{ gridTemplateColumns: '70px repeat(7, 1fr)', height: '80px' }}>
                <div className="border-r border-white/[0.08] flex items-start justify-end pr-3 pt-2 bg-white/[0.01]">
                  <span className="text-white/25 text-xs font-mono group-hover:text-white/40 transition-colors">{hour}:00</span>
                </div>
                {weekDays.map(day => (
                  <div
                    key={day.toISOString()}
                    className={`border-r border-white/[0.04] last:border-r-0 transition-colors ${
                      isToday(day) ? 'bg-blue-500/[0.03]' : 'hover:bg-white/[0.02]'
                    }`}
                  />
                ))}
              </div>
            ))}

            {/* Overlay: positioned booking blocks */}
            {weekDays.map((day, dayIndex) => {
              const dayLeads = getLeadsForDate(day);
              return dayLeads.map(lead => {
                if (!lead.call_scheduled_at) return null;
                const start = new Date(lead.call_scheduled_at);
                const startHour = start.getHours() + start.getMinutes() / 60;
                const duration = (lead.call_scheduled_duration || 30) / 60;
                const dayStart = 8;
                const dayEnd = 21;
                const hourHeight = 80;

                if (startHour < dayStart || startHour >= dayEnd) return null;

                const top = (startHour - dayStart) * hourHeight;
                const height = Math.max(duration * hourHeight, 44);
                const leftPercent = ((dayIndex + 1) / 8) * 100;
                const widthPercent = (1 / 8) * 100;

                const color = getCallStatusColor(lead);
                const setterColor = lead.setter_name ? getSetterColor(lead.setter_name) : null;

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`absolute rounded-lg px-2.5 py-1.5 cursor-pointer pointer-events-auto
                      transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:z-20 overflow-hidden
                      bg-gradient-to-r ${
                        color === 'noshow' ? 'from-red-600/40 to-red-600/25 border-2 border-dashed border-red-500/70 hover:border-red-400'
                        : color === 'violet' ? 'from-violet-500/35 to-violet-500/20 border border-violet-400/50 hover:border-violet-400/80'
                        : color === 'amber' ? 'from-amber-500/35 to-amber-500/20 border border-amber-400/50 hover:border-amber-400/80'
                        : color === 'red' ? 'from-red-500/30 to-red-500/15 border border-red-400/50 hover:border-red-400/80'
                        : color === 'gray' ? 'from-white/10 to-white/5 border border-white/20 hover:border-white/40'
                        : 'from-blue-500/35 to-blue-500/20 border border-blue-400/50 hover:border-blue-400/80'
                      }
                    `}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: `calc(${leftPercent}% + 4px)`,
                      width: `calc(${widthPercent}% - 8px)`,
                    }}
                  >
                    {/* No-show badge */}
                    {lead.call_no_show && (
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-red-500/40 px-1.5 py-0.5 rounded">
                        <UserX className="w-2.5 h-2.5 text-red-300" />
                        <span className="text-[8px] text-red-300 font-display uppercase">No-show</span>
                      </div>
                    )}

                    <div className="flex items-start gap-1.5">
                      <span className={`font-mono text-xs font-semibold shrink-0 ${
                        color === 'noshow' ? 'text-red-400/80' : color === 'blue' ? 'text-blue-300' : color === 'violet' ? 'text-violet-300' : 'text-white/70'
                      }`}>
                        {format(start, 'HH:mm')}
                      </span>
                      <span className={`font-display text-xs truncate ${
                        lead.call_no_show ? 'line-through text-white/40' : 'text-white font-medium'
                      }`}>
                        {lead.first_name || lead.email?.split('@')[0]}
                      </span>
                    </div>
                    {(lead.setter_name || lead.closer_name) && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {lead.closer_name && <span className="text-[10px] text-violet-300/80 font-display">{lead.closer_name}</span>}
                        {lead.setter_name && setterColor && <span className={`text-[10px] ${setterColor.text} font-display`}>{lead.setter_name}</span>}
                      </div>
                    )}
                    {lead.call_outcome && CALL_OUTCOME_STYLES[lead.call_outcome] && (
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-display font-semibold ${CALL_OUTCOME_STYLES[lead.call_outcome].text}`}>
                          {lead.call_outcome === 'contracted' && '✓ '}{CALL_OUTCOME_STYLES[lead.call_outcome].label}
                        </span>
                      </div>
                    )}
                  </div>
                );
              });
            })}

            {/* Current time indicator */}
            {weekDays.some(d => isToday(d)) && (() => {
              const now = new Date();
              const currentHour = now.getHours() + now.getMinutes() / 60;
              if (currentHour < 8 || currentHour > 21) return null;
              const top = (currentHour - 8) * 80;
              return (
                <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: `${top}px`, marginLeft: '70px' }}>
                  <div className="h-0.5 bg-red-500 relative">
                    <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        /* =============== LIST VIEW (day / month / all) =============== */
        <div className="space-y-2">
          {filteredLeads.map(lead => {
            const color = getCallStatusColor(lead);
            const setterColor = lead.setter_name ? getSetterColor(lead.setter_name) : null;
            const start = lead.call_scheduled_at ? new Date(lead.call_scheduled_at) : null;
            const isPast = start ? start < new Date() : false;

            return (
              <button
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all hover:scale-[1.01] ${
                  color === 'noshow' ? 'bg-red-500/15 border-2 border-dashed border-red-500/60 hover:border-red-400'
                  : color === 'violet' ? 'bg-violet-500/15 border border-violet-400/40 hover:border-violet-400/70'
                  : color === 'amber' ? 'bg-amber-500/15 border border-amber-400/40 hover:border-amber-400/70'
                  : color === 'red' ? 'bg-red-500/15 border border-red-400/40 hover:border-red-400/70'
                  : color === 'gray' ? 'bg-white/[0.05] border border-white/15 hover:border-white/30'
                  : 'bg-blue-500/10 border border-blue-400/30 hover:border-blue-400/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {start && (
                    <div className="text-center shrink-0 w-14">
                      <div className="text-[10px] text-white/50 uppercase font-display">{format(start, 'd MMM', { locale: fr })}</div>
                      <div className={`text-sm font-mono font-semibold ${
                        color === 'blue' ? 'text-blue-300' : color === 'violet' ? 'text-violet-300' : 'text-white/70'
                      }`}>{format(start, 'HH:mm')}</div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-display ${lead.call_no_show ? 'line-through text-white/40' : 'text-white font-medium'}`}>
                      {lead.first_name || lead.email?.split('@')[0]}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.closer_name && <span className="text-[10px] text-violet-300/80 font-display">{lead.closer_name}</span>}
                      {lead.setter_name && setterColor && <span className={`text-[10px] ${setterColor.text} font-display`}>{lead.setter_name}</span>}
                      {lead.call_no_show && <span className="text-[10px] text-red-400 font-semibold">No-show</span>}
                      {lead.call_rescheduled_at && <span className="text-[10px] text-amber-400">Replanifie</span>}
                      {isPast && lead.call_outcome && CALL_OUTCOME_STYLES[lead.call_outcome] && (
                        <span className={`text-[10px] font-semibold ${CALL_OUTCOME_STYLES[lead.call_outcome].text}`}>
                          {lead.call_outcome === 'contracted' && '✓ '}{CALL_OUTCOME_STYLES[lead.call_outcome].label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* =============== SHARED LEAD DETAIL MODAL =============== */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onLeadUpdated={fetchLeads}
        />
      )}
    </div>
  );
}
