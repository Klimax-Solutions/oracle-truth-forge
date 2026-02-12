import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";

interface MentionUser {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface MentionAutocompleteProps {
  allUsers: MentionUser[];
  message: string;
  onSelect: (user: MentionUser) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export const MentionAutocomplete = ({
  allUsers,
  message,
  onSelect,
  textareaRef,
}: MentionAutocompleteProps) => {
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Detect @query pattern at end of message or at cursor
  useEffect(() => {
    const cursorPos = textareaRef?.current?.selectionStart ?? message.length;
    const textBeforeCursor = message.slice(0, cursorPos);
    
    // Find the last @ that starts a mention (not @everyone)
    const mentionMatch = textBeforeCursor.match(/@(?!everyone)(\w*)$/);
    
    if (mentionMatch) {
      setQuery(mentionMatch[1].toLowerCase());
      setShow(true);
      setSelectedIndex(0);
    } else {
      setShow(false);
      setQuery("");
    }
  }, [message, textareaRef]);

  const filtered = useMemo(() => {
    if (!show) return [];
    const results: MentionUser[] = [];
    
    // Always show @everyone option first
    const everyoneMatch = !query || "everyone".startsWith(query);
    
    const userMatches = allUsers.filter((u) =>
      u.display_name.toLowerCase().startsWith(query) ||
      u.display_name.toLowerCase().includes(query)
    ).slice(0, 8);

    if (everyoneMatch) {
      results.push({ user_id: "__everyone__", display_name: "everyone", avatar_url: null });
    }
    results.push(...userMatches);
    
    return results;
  }, [allUsers, query, show]);

  // Keyboard navigation
  useEffect(() => {
    if (!show || filtered.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (show && filtered.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(filtered[selectedIndex]);
          setShow(false);
        }
      } else if (e.key === "Escape") {
        setShow(false);
      }
    };

    const textarea = textareaRef?.current;
    if (textarea) {
      textarea.addEventListener("keydown", handleKeyDown, true);
      return () => textarea.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [show, filtered, selectedIndex, onSelect, textareaRef]);

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!show || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div
        ref={listRef}
        className="bg-popover border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto py-1"
      >
        <div className="px-2 py-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Membres — {filtered.length}
          </span>
        </div>
        {filtered.map((user, i) => {
          const isEveryone = user.user_id === "__everyone__";
          const initials = (user.display_name || "A").charAt(0).toUpperCase();

          return (
            <button
              key={user.user_id}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors",
                i === selectedIndex
                  ? "bg-primary/10 text-foreground"
                  : "text-foreground/80 hover:bg-muted/50"
              )}
              onMouseEnter={() => setSelectedIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent textarea blur
                onSelect(user);
                setShow(false);
              }}
            >
              {isEveryone ? (
                <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs">@</span>
                </div>
              ) : user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-muted-foreground">{initials}</span>
                </div>
              )}
              <span className={cn(
                "text-sm font-medium truncate",
                isEveryone && "text-yellow-600 dark:text-yellow-400"
              )}>
                {isEveryone ? "@everyone" : user.display_name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
