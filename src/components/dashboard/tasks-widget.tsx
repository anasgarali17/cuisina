"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import { toggleTache } from "@/lib/actions/tache-actions";
import { formatDate, startOfToday } from "@/lib/dates";
import type { TacheRow } from "@/lib/database.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Today's and overdue tasks, checkable inline with optimistic state. */
export function TasksWidget({
  taches,
  ficheNames,
}: {
  taches: TacheRow[];
  ficheNames: Record<string, string>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const today = startOfToday();

  function toggle(id: string, next: boolean) {
    setError(null);
    setDone((prev) => {
      const set = new Set(prev);
      if (next) set.add(id);
      else set.delete(id);
      return set;
    });
    void toggleTache({ id, done: next }).then((result) => {
      if (!result.ok) {
        setDone((prev) => {
          const set = new Set(prev);
          if (next) set.delete(id);
          else set.add(id);
          return set;
        });
        setError(
          result.error === "demo_mode" ? t("app.demoReadOnly") : t("app.error"),
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary"
          >
            <ListChecks className="size-3.5" />
          </span>
          {t("dashboard.tasks.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {taches.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            {t("dashboard.tasks.empty")}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {taches.map((task) => {
              const isDone = done.has(task.id);
              const overdue =
                task.echeance !== null && new Date(task.echeance) < today;
              return (
                <li key={task.id} className="flex items-start gap-3">
                  <Checkbox
                    checked={isDone}
                    onCheckedChange={(v) => toggle(task.id, v === true)}
                    aria-label={task.titre}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        isDone && "text-muted-foreground line-through",
                      )}
                    >
                      {task.titre}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {task.fiche_id && ficheNames[task.fiche_id] && (
                        <span>{ficheNames[task.fiche_id]} · </span>
                      )}
                      {task.echeance && (
                        <span
                          className={cn(overdue && "font-medium text-ambre")}
                        >
                          {formatDate(task.echeance, "d MMM", locale)}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="mt-3 text-xs font-medium text-rouge">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
