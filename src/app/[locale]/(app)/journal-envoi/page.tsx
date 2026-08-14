import { redirect } from "next/navigation";

/** Le journal vit désormais dans le fil WhatsApp — voir /messages. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/messages`);
}
