"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createTache, toggleTache } from "@/lib/actions/tache-actions";
import { formatDate, startOfToday } from "@/lib/dates";
import { PRIORITES, type Canal, type Priorite } from "@/lib/domain";
import type { ProfileRow, TacheRow } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/page-header";
import { RelanceDialog } from "@/components/fiches/relance-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const CANAL_ICONS: Record<Canal, typeof Phone> = {
  whatsapp: MessageCircle,
  appel: Phone,
  sms: MessageSquare,
  email: Mail,
  visite: MapPin,
};

const NONE = "__none__";

type GroupKey = "retard" | "aujourdhui" | "semaine" | "plusTard";

interface FicheRef {
  reference: string;
  client: string;
}

export function TachesBoard({
  taches: initialTaches,
  ficheMap,
  profiles,
  currentProfile,
}: {
  taches: TacheRow[];
  ficheMap: Record<string, FicheRef>;
  profiles: ProfileRow[];
  currentProfile: ProfileRow;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [taches, setTaches] = useState(initialTaches);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [relanceTask, setRelanceTask] = useState<TacheRow | null>(null);

  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const today = startOfToday();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const groups = useMemo(() => {
    const open = taches.filter((task) => task.statut === "a_faire");
    const map: Record<GroupKey, TacheRow[]> = {
      retard: [],
      aujourdhui: [],
      semaine: [],
      plusTard: [],
    };
    for (const task of open) {
      if (!task.echeance) {
        map.plusTard.push(task);
        continue;
      }
      const due = new Date(task.echeance);
      if (due < today) map.retard.push(task);
      else if (due.getTime() === today.getTime()) map.aujourdhui.push(task);
      else if (due < weekEnd) map.semaine.push(task);
      else map.plusTard.push(task);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taches]);

  const doneTasks = taches.filter((task) => task.statut === "fait");

  function setStatut(id: string, statut: "a_faire" | "fait") {
    setTaches((list) =>
      list.map((task) => (task.id === id ? { ...task, statut } : task)),
    );
  }

  function onCheck(task: TacheRow, next: boolean) {
    setError(null);
    // A relance task completes through the relance flow, not a plain check.
    if (next && task.auto_generee && task.fiche_id) {
      setRelanceTask(task);
      return;
    }
    const previous = task.statut;
    setStatut(task.id, next ? "fait" : "a_faire");
    void toggleTache({ id: task.id, done: next }).then((result) => {
      if (!result.ok) {
        setStatut(task.id, previous);
        setError(
          result.error === "demo_mode" ? t("app.demoReadOnly") : t("app.error"),
        );
      }
    });
  }

  const hasAnything = taches.length > 0;

  return (
    <div>
      <PageHeader
        title={t("taches.title")}
        actions={
          <Button className="neo neo-hover" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            {t("taches.new")}
          </Button>
        }
      />

      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-rouge">
          {error}
        </p>
      )}

      {!hasAnything ? (
        <div className="grid min-h-[40vh] place-items-center rounded-3xl border border-dashed border-border bg-card/60">
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("taches.empty")}</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("taches.new")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(
            [
              ["retard", groups.retard],
              ["aujourdhui", groups.aujourdhui],
              ["semaine", groups.semaine],
              ["plusTard", groups.plusTard],
            ] as const
          ).map(([key, list]) =>
            list.length === 0 ? null : (
              <section key={key}>
                <h2
                  className={cn(
                    "mb-2 flex items-center gap-2 text-sm font-semibold",
                    key === "retard" && "text-ambre",
                  )}
                >
                  <span className="rounded-full bg-secondary px-2 font-mono text-xs text-muted-foreground">
                    {list.length}
                  </span>
                  {key === "retard" && <TriangleAlert className="size-4" />}
                  {t(`taches.groups.${key}`)}
                </h2>
                <ul className="space-y-2">
                  {list.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      ficheMap={ficheMap}
                      profileById={profileById}
                      currentUserId={currentProfile.id}
                      overdue={key === "retard"}
                      onCheck={onCheck}
                    />
                  ))}
                </ul>
              </section>
            ),
          )}

          {doneTasks.length > 0 && (
            <Accordion type="single" collapsible>
              <AccordionItem value="done" className="border-b-0">
                <AccordionTrigger className="text-muted-foreground">
                  {t("taches.done")}{" "}
                  <span className="ms-1 font-mono text-xs">
                    {doneTasks.length}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2">
                    {doneTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        ficheMap={ficheMap}
                        profileById={profileById}
                        currentUserId={currentProfile.id}
                        done
                        onCheck={onCheck}
                      />
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        ficheMap={ficheMap}
        profiles={profiles}
        currentProfile={currentProfile}
        onCreated={() => router.refresh()}
      />

      {relanceTask && relanceTask.fiche_id && (
        <RelanceDialog
          ficheId={relanceTask.fiche_id}
          tacheId={relanceTask.id}
          defaultCanal={relanceTask.canal}
          open
          onOpenChange={(open) => {
            if (!open) setRelanceTask(null);
          }}
          onDone={() => {
            setStatut(relanceTask.id, "fait");
            setRelanceTask(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  ficheMap,
  profileById,
  currentUserId,
  overdue,
  done,
  onCheck,
}: {
  task: TacheRow;
  ficheMap: Record<string, FicheRef>;
  profileById: Map<string, ProfileRow>;
  currentUserId: string;
  overdue?: boolean;
  done?: boolean;
  onCheck: (task: TacheRow, next: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fiche = task.fiche_id ? ficheMap[task.fiche_id] : undefined;
  const assignee =
    task.assigne_a !== currentUserId ? profileById.get(task.assigne_a) : null;
  const CanalIcon = task.canal ? CANAL_ICONS[task.canal] : null;

  return (
    <li
      className={cn(
        "flex min-h-11 items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3",
        done && "opacity-60",
      )}
    >
      <Checkbox
        checked={done ?? false}
        onCheckedChange={(v) => onCheck(task, v === true)}
        aria-label={task.titre}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "line-through")}>
          {task.titre}
        </p>
        {task.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {task.description}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={
              task.priorite === "haute"
                ? "rouge"
                : task.priorite === "basse"
                  ? "outline"
                  : "default"
            }
          >
            {t(`taches.${task.priorite}`)}
          </Badge>
          {task.auto_generee && (
            <Badge variant="chene">
              {CanalIcon && <CanalIcon className="size-3" />}
              {t("taches.auto")}
            </Badge>
          )}
          {fiche && task.fiche_id && (
            <Link
              href={`/fiches/${task.fiche_id}`}
              className="font-mono text-[10px] text-muted-foreground underline-offset-2 hover:underline"
            >
              {fiche.reference}
            </Link>
          )}
          {task.echeance && (
            <span
              className={cn(
                "text-xs text-muted-foreground",
                overdue && "font-medium text-ambre",
              )}
            >
              {formatDate(task.echeance, "d MMM", locale)}
            </span>
          )}
        </div>
      </div>
      {assignee && (
        <Avatar
          className="size-7"
          title={`${assignee.prenom} ${assignee.nom}`}
        >
          <AvatarFallback className="text-[10px]">
            {assignee.prenom.charAt(0)}
            {assignee.nom.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )}
    </li>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  ficheMap,
  profiles,
  currentProfile,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ficheMap: Record<string, FicheRef>;
  profiles: ProfileRow[];
  currentProfile: ProfileRow;
  onCreated: () => void;
}) {
  const t = useTranslations();
  const [titre, setTitre] = useState("");
  const [description, setDescription] = useState("");
  const [echeance, setEcheance] = useState("");
  const [priorite, setPriorite] = useState<Priorite>("normale");
  const [ficheId, setFicheId] = useState(NONE);
  const [assigneA, setAssigneA] = useState(currentProfile.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canAssign = currentProfile.role !== "conseiller";
  const assignables = profiles.filter(
    (p) => p.role === "conseiller" || p.id === currentProfile.id,
  );

  function submit() {
    if (!titre.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createTache({
        titre: titre.trim(),
        description,
        echeance: echeance || null,
        priorite,
        fiche_id: ficheId === NONE ? null : ficheId,
        assigne_a: assigneA,
      });
      if (!result.ok) {
        setError(
          result.error === "demo_mode" ? t("app.demoReadOnly") : t("app.error"),
        );
        return;
      }
      setTitre("");
      setDescription("");
      setEcheance("");
      setPriorite("normale");
      setFicheId(NONE);
      onOpenChange(false);
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("taches.new")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-titre">{t("taches.titre")}</Label>
            <Input
              id="task-titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">{t("taches.description")}</Label>
            <Textarea
              id="task-desc"
              className="min-h-16"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-echeance">{t("taches.echeance")}</Label>
              <DatePicker
                id="task-echeance"
                value={echeance}
                onChange={setEcheance}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-priorite">{t("taches.priorite")}</Label>
              <Select
                value={priorite}
                onValueChange={(v) => setPriorite(v as Priorite)}
              >
                <SelectTrigger id="task-priorite">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`taches.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-fiche">
              {t("taches.fiche")}{" "}
              <span className="text-muted-foreground">
                ({t("app.optional")})
              </span>
            </Label>
            <Select value={ficheId} onValueChange={setFicheId}>
              <SelectTrigger id="task-fiche">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {Object.entries(ficheMap).map(([id, ref]) => (
                  <SelectItem key={id} value={id}>
                    {ref.reference} · {ref.client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canAssign && (
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">{t("taches.assigneA")}</Label>
              <Select value={assigneA} onValueChange={setAssigneA}>
                <SelectTrigger id="task-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignables.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-rouge">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("app.cancel")}
          </Button>
          <Button onClick={submit} disabled={pending || !titre.trim()}>
            {t("app.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
