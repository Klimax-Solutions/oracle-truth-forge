// ============================================
// Admin Funnel List — Create/Edit/Delete funnels
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Loader2, Layers, ExternalLink, Trash2, Copy,
  MoreHorizontal, Power, PowerOff, Pencil, X, ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';



import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Funnel {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  url_prefix: string;
  created_at: string;
  updated_at: string;
}

export default function AdminFunnelList({ onEditFunnel }: { onEditFunnel?: (id: string) => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);

  const canEdit = true; // Oracle: admins can always edit

  const loadFunnels = async () => {
    // Safety timeout: if the query hangs (AbortError in dev / network issue),
    // force loading=false after 6s so the spinner never stays forever.
    const safetyTimer = setTimeout(() => setLoading(false), 6000);
    try {
      const { data } = await supabase
        .from('funnels')
        .select('*')
        .order('created_at', { ascending: true });
      setFunnels((data as unknown as Funnel[]) || []);
    } catch (err) {
      console.warn('[FunnelList] loadFunnels error:', err);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFunnels();
  }, []);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const slug = newSlug.trim() || slugify(newName);

    const { data, error } = await supabase
      .from('funnels')
      .insert({ name: newName.trim(), slug })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erreur', description: error.message.includes('unique') ? 'Ce slug existe deja' : error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Funnel cree' });
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      await loadFunnels();
      if (data) onEditFunnel?.((data as any).id);
    }
    setCreating(false);
  };

  const handleDuplicate = async (funnel: Funnel) => {
    
    const newSlugVal = `${funnel.slug}-copy-${Date.now().toString(36).slice(-4)}`;

    // 1. Create new funnel
    const { data: newFunnel, error } = await supabase
      .from('funnels')
      .insert({ name: `${funnel.name} (copie)`, slug: newSlugVal })
      .select()
      .single();

    if (error || !newFunnel) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur', variant: 'destructive' });
      return;
    }

    // 2. Copy config from original funnel
    const { data: originalConfig } = await supabase
      .from('funnel_config')
      .select('*')
      .eq('funnel_id', funnel.id)
      .maybeSingle();

    if (originalConfig) {
      const { id, funnel_id, created_at, updated_at, ...configData } = originalConfig as any;
      await supabase.from('funnel_config').insert({
        ...configData,
        funnel_id: (newFunnel as any).id,
        
      });
    }

    toast({ title: 'Funnel duplique avec sa configuration' });
    loadFunnels();
  };

  const handleToggleActive = async (funnel: Funnel) => {
    const { error } = await supabase
      .from('funnels')
      .update({ is_active: !funnel.is_active })
      .eq('id', funnel.id);
    if (error) { console.warn(error.message); }
    else loadFunnels();
  };

  const handleDelete = async (funnel: Funnel) => {
    if (!confirm(`Supprimer "${funnel.name}" ? Cette action est irréversible.`)) return;
    const { error } = await supabase.from('funnels').delete().eq('id', funnel.id);
    if (error) { console.warn(error.message); }
    else {
      toast({ title: 'Funnel supprime' });
      loadFunnels();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
      <div className="min-h-full bg-[#08080d]">
        {/* Header */}
        <header className="border-b border-white/[0.10] bg-black/60 backdrop-blur-xl sticky top-0 z-50">
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <div className="container max-w-5xl mx-auto px-3 md:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-lg tracking-[0.2em] text-white uppercase">Funnels</h1>
                <p className="text-[10px] text-primary/50 tracking-wider">{funnels.length} funnel{funnels.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {canEdit && (
              <Button
                onClick={() => setShowCreate(true)}
                className="font-display text-[10px] tracking-[0.15em] uppercase bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(25,183,201,0.2)] h-9 px-5 rounded-xl"
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                Créer un funnel
              </Button>
            )}
          </div>
        </header>

        <main className="container max-w-5xl mx-auto px-3 md:px-6 py-4 md:py-8">
          {/* Create modal */}
          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mb-6 md:mb-8 rounded-2xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-primary/20 p-4 md:p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm tracking-[0.15em] uppercase text-white">Nouveau funnel</h2>
                  <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">Nom</Label>
                    <Input
                      value={newName}
                      onChange={(e) => { setNewName(e.target.value); if (!newSlug) setNewSlug(slugify(e.target.value)); }}
                      placeholder="Funnel VIP Trading"
                      className="bg-white/[0.03] border-white/[0.06] text-white h-10 rounded-xl"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-display text-[10px] tracking-[0.15em] uppercase text-white/40">Slug (URL)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/20 font-mono">/</span>
                      <Input
                        value={newSlug}
                        onChange={(e) => setNewSlug(slugify(e.target.value))}
                        placeholder="vip"
                        className="bg-white/[0.03] border-white/[0.06] text-white h-10 rounded-xl font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[10px] text-white/30">Pages :</span>
                  <code className="text-[11px] text-primary/60 font-mono">/{newSlug || 'slug'}/apply</code>
                  <span className="text-white/15">→</span>
                  <code className="text-[11px] text-primary/60 font-mono">/{newSlug || 'slug'}/discovery</code>
                  <span className="text-white/15">→</span>
                  <code className="text-[11px] text-primary/60 font-mono">/{newSlug || 'slug'}/final</code>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white">Annuler</Button>
                  <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-primary hover:bg-primary/90 rounded-xl font-display text-[10px] tracking-[0.15em] uppercase">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
                    Créer
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Funnel list */}
          {funnels.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Layers className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-sm text-white/30 font-display">Aucun funnel</p>
              <p className="text-xs text-white/15">Créez votre premier funnel pour commencer</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {funnels.map((funnel, i) => (
                <motion.div
                  key={funnel.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "group rounded-2xl border backdrop-blur-sm transition-all duration-200 hover:border-white/[0.12]",
                    funnel.is_active
                      ? "bg-gradient-to-br from-white/[0.05] to-white/[0.02] border-white/[0.07]"
                      : "bg-white/[0.01] border-white/[0.04] opacity-60"
                  )}
                >
                  <div className="p-5 flex items-center gap-5 cursor-pointer" onClick={() => onEditFunnel?.(funnel.id)}>
                    {/* Icon */}
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                      funnel.is_active
                        ? "bg-primary/10 border-primary/20"
                        : "bg-white/[0.03] border-white/[0.06]"
                    )}>
                      <Layers className={cn("w-5 h-5", funnel.is_active ? "text-primary" : "text-white/30")} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-display text-base text-white tracking-wide truncate">{funnel.name}</h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-display tracking-wider uppercase border",
                          funnel.is_active
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-white/[0.03] border-white/[0.06] text-white/30"
                        )}>
                          {funnel.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5">
                        <code className="text-[11px] text-primary/60 font-mono">/{funnel.slug}</code>
                        <span className="text-[10px] text-white/20">
                          apply → discovery → final · {new Date(funnel.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`/${funnel.slug}/apply`}
                        target="_blank"
                        rel="noopener"
                        className="p-2 rounded-lg text-white/20 hover:text-primary hover:bg-primary/10 transition-all"
                        title="Voir le funnel"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      {canEdit && (
                        <>
                          <button
                            onClick={() => handleDuplicate(funnel)}
                            className="p-2 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.04] transition-all"
                            title="Dupliquer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(funnel)}
                            className="p-2 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.04] transition-all"
                            title={funnel.is_active ? 'Désactiver' : 'Activer'}
                          >
                            {funnel.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(funnel)}
                            className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <Button
                        onClick={() => onEditFunnel?.(funnel.id)}
                        size="sm"
                        className="font-display text-[10px] tracking-[0.12em] uppercase bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] hover:border-primary/30 text-white/70 hover:text-white rounded-xl h-9 px-4"
                      >
                        <Pencil className="w-3 h-3 mr-2" />
                        Éditer
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
  );
}
