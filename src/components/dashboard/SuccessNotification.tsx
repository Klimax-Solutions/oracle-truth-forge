import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuccessConfetti } from "./SuccessConfetti";

interface Notification {
  id: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const SUCCESS_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3";

const SuccessNotification = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { fireConfetti } = useSuccessConfetti();
  const initialLoadDone = useRef(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    audioRef.current = new Audio(SUCCESS_SOUND_URL);
    audioRef.current.volume = 0.5;

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Listen for success posts
    const channel = supabase
      .channel("success_notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "user_successes" }, async (payload) => {
        if (!initialLoadDone.current) return;
        const newRow = payload.new as any;

        let displayName = "Quelqu'un";
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", newRow.user_id).single();
        if (profile?.display_name) displayName = profile.display_name;

        const isMe = newRow.user_id === userId;
        const msg = isMe ? "Vous avez partagé un nouveau succès !" : `${displayName} a partagé un nouveau succès !`;

        setNotifications((prev) => [{ id: newRow.id, message: msg, timestamp: new Date(), read: false }, ...prev].slice(0, 50));
        playSound();
        fireConfetti();
      })
      .subscribe();

    // Listen for @everyone notifications
    const notifChannel = supabase
      .channel("bell_notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "user_notifications",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const row = payload.new as any;
        setNotifications((prev) => [
          { id: row.id, message: row.message, timestamp: new Date(), read: false },
          ...prev,
        ].slice(0, 50));
        playSound();
      })
      .subscribe();

    const timer = setTimeout(() => { initialLoadDone.current = true; }, 2000);

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
    };
  }, [userId, playSound, fireConfetti]);

  const markAllRead = () => { setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))); };
  const handleToggle = () => { if (!isOpen) markAllRead(); setIsOpen(!isOpen); };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="w-80 max-h-96 bg-card border border-border rounded-lg shadow-2xl overflow-hidden animate-fade-in mb-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold">Notifications</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-y-auto max-h-72 divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">Aucune notification</div>
            ) : notifications.map((n) => (
              <div key={n.id} className={cn("px-4 py-3 text-sm transition-colors", !n.read && "bg-yellow-500/5")}>
                <p className="text-foreground">{n.message}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {n.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={handleToggle} className={cn(
        "relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all",
        "bg-card border border-border hover:border-yellow-500/50 hover:shadow-yellow-500/10",
        isOpen && "border-yellow-500/50"
      )}>
        <Bell className={cn("w-6 h-6 text-foreground", unreadCount > 0 && "animate-bounce")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center px-1">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export { SuccessNotification };
