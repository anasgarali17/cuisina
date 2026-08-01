"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Suivi / Historique switcher on the fiche detail side column. */
export function DetailTabs({
  suivi,
  historique,
}: {
  suivi: React.ReactNode;
  historique: React.ReactNode;
}) {
  const t = useTranslations();

  return (
    <Tabs defaultValue="suivi">
      <TabsList className="w-full">
        <TabsTrigger value="suivi" className="flex-1">
          {t("fiches.detail.suivi")}
        </TabsTrigger>
        <TabsTrigger value="historique" className="flex-1">
          {t("fiches.detail.historique")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="suivi">{suivi}</TabsContent>
      <TabsContent value="historique">{historique}</TabsContent>
    </Tabs>
  );
}
