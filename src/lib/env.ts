/**
 * Supabase is optional at runtime until credentials are provisioned:
 * with no env vars the app runs in demo mode on in-memory data,
 * so the UI stays reviewable. Mutations are disabled in demo mode.
 */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * La passerelle WhatsApp Business. Tant qu'elle est absente, les séquences
 * calculent leur file d'attente et s'arrêtent là : le conseiller l'envoie à
 * la main. C'est volontaire — on veut voir plusieurs semaines de messages
 * simulés avant qu'un seul parte tout seul.
 */
export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
  );
}

/**
 * La clé d'accès Sage, dont dépend « Règlements & encaissements ».
 *
 * Sans elle, la section n'apparaît nulle part : ni dans le menu, ni à qui
 * taperait l'adresse. Un écran de comptabilité vide vaut moins que pas
 * d'écran du tout — il laisse croire qu'il n'y a rien à encaisser.
 *
 * `NEXT_PUBLIC_` à dessein : la barre de navigation est rendue côté client,
 * et ce drapeau ne dit que « la passerelle existe », jamais la clé elle-même.
 */
export function sageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SAGE_ACTIF);
}

/**
 * L'expéditeur des e-mails. Absent, le rappel quotidien de 15 h se calcule
 * mais ne part pas — même prudence que pour WhatsApp.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
