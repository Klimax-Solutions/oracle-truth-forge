/**
 * useLeadDuplicates — détecte si un email/phone a déjà :
 *  • soumis le formulaire (autres rows dans early_access_requests)  → warning
 *  • un compte membre actif (role member dans user_roles)            → alerte critique
 *
 * 100% non-bloquant : en cas d'erreur DB, retourne un état neutre.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeadDuplicateInfo {
  loading: boolean;
  /** Autres soumissions du formulaire pour ce même email (hors lead courant) */
  otherSubmissions: Array<{
    id: string;
    first_name: string;
    status: string;
    created_at: string;
  }>;
  /** Si true → ce lead correspond à un user qui a déjà le rôle 'member' (client actif) */
  isExistingMember: boolean;
  /** Détail des rôles trouvés sur le user lié (si user_id présent) */
  existingRoles: string[];
}

export function useLeadDuplicates(params: {
  requestId: string;
  email: string | null;
  userId: string | null;
}): LeadDuplicateInfo {
  const { requestId, email, userId } = params;
  const [info, setInfo] = useState<LeadDuplicateInfo>({
    loading: true,
    otherSubmissions: [],
    isExistingMember: false,
    existingRoles: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result: LeadDuplicateInfo = {
        loading: false,
        otherSubmissions: [],
        isExistingMember: false,
        existingRoles: [],
      };

      // 1. Autres soumissions avec le même email (hors lead courant)
      if (email) {
        try {
          const { data } = await supabase
            .from("early_access_requests")
            .select("id, first_name, status, created_at")
            .ilike("email", email.trim())
            .neq("id", requestId)
            .order("created_at", { ascending: false });
          if (data) result.otherSubmissions = data as any;
        } catch (err) {
          console.warn("[useLeadDuplicates] submissions check failed:", err);
        }
      }

      // 2. Rôles existants sur le user lié → si 'member' actif → c'est un client
      if (userId) {
        try {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (data) {
            const roles = data.map((r: any) => r.role).filter(Boolean) as string[];
            result.existingRoles = roles;
            result.isExistingMember = roles.includes("member");
          }
        } catch (err) {
          console.warn("[useLeadDuplicates] roles check failed:", err);
        }
      }

      if (!cancelled) setInfo(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, email, userId]);

  return info;
}
