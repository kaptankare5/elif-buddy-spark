import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Crown } from "lucide-react";

interface HonorRow { display_name: string | null; since: string | null }

export function HonorList() {
  const [rows, setRows] = useState<HonorRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("honor_list");
      if (cancelled) return;
      if (error) { setRows([]); return; }
      setRows((data as HonorRow[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!rows) return null;

  return (
    <section className="mt-6 rounded-3xl bg-gradient-to-br from-warning/15 to-primary/10 p-4 border-4 border-warning/30 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <Crown className="h-5 w-5 text-warning" />
        <h2 className="text-base font-extrabold text-foreground">Onur Listesi</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs font-semibold text-muted-foreground text-center py-3">
          Henüz üye yok. İlk sen ol! 🌟
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rows.map((r, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-extrabold text-primary shadow-soft border-2 border-warning/40"
            >
              👑 {r.display_name || "Onur Üyesi"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
