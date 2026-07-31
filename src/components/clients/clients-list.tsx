"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ClientRow } from "@/lib/database.types";
import { formatDT } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function nameInitials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function ClientsList({ clients }: { clients: ClientRow[] }) {
  const t = useTranslations();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.nom, c.tel ?? "", c.ville ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [clients, query]);

  if (clients.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {t("clients.empty")}
        </p>
      </Card>
    );
  }

  return (
    <div>
      <div className="relative mb-4 w-full max-w-sm">
        <Label htmlFor="client-search" className="sr-only">
          {t("clients.searchPlaceholder")}
        </Label>
        <Search
          aria-hidden
          className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="client-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("clients.searchPlaceholder")}
          className="ps-11"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((client) => (
          <Link key={client.id} href={`/clients/${client.id}`}>
            <Card className="card-lift h-full p-5">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{nameInitials(client.nom)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold">
                    {client.nom}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {client.ville ?? "—"}
                    {client.tel && (
                      <>
                        {" · "}
                        <span className="font-mono">{client.tel}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="font-mono text-sm">
                  {formatDT(client.ca_cumule)}
                </span>
                <Badge variant="outline">
                  {t("clients.nbProjets", { count: client.nb_projets })}
                </Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
