import { data } from '@kumo/shared';
import { createClient } from '@/lib/supabase-anon-server';
import LandingClient, { type LandingContent } from './LandingClient';

/** La landing es pública: lee planes, FAQ y contacto (editables desde el admin). */
export const revalidate = 60;

export default async function Page() {
  const supabase = createClient();
  const [plansRes, faqsRes, settingsRes] = await Promise.all([
    supabase.from('plans').select('id, name, base_price, tagline, perks, featured'),
    supabase.from('faqs').select('id, question, answer, order').order('order', { ascending: true }),
    supabase.from('club_settings').select('whatsapp, email').eq('id', 1).single(),
  ]);

  const PLAN_ORDER = ['AMIGO', 'FAMILIA', 'VIP'];
  const plans = (plansRes.data ?? [])
    .map((p) => ({ id: p.id, name: p.name, basePrice: p.base_price, tagline: p.tagline, perks: p.perks ?? [], featured: p.featured }))
    .sort((a, b) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name));

  // Si la base todavía no respondió, la landing cae al contenido de @kumo/shared
  // antes que mostrarse vacía.
  const content: LandingContent = {
    plans: plans.length > 0 ? plans : data.plans,
    faqs: faqsRes.data?.length ? faqsRes.data : data.faqs,
    whatsapp: settingsRes.data?.whatsapp ?? data.clubSettings.whatsapp,
    email: settingsRes.data?.email ?? data.clubSettings.email,
  };

  return <LandingClient content={content} />;
}
