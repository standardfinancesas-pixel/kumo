import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { etiquetaPlan, hoyISO, urls } from '@kumo/shared';
import { CarnetAlta } from '@/components/CarnetAlta';
import { AltaListoClient } from './AltaListoClient';

/**
 * "¡Bienvenido al club!" — la última pantalla del alta.
 *
 * Es una RUTA y no un estado del formulario por dos razones concretas:
 *
 *  · Es a donde vuelve Mercado Pago después de pagar. Si fuera un estado del
 *    componente, el viaje al checkout se lo llevaría, y el socio volvería a `/app`
 *    sin ver nunca el carnet de sus mascotas.
 *  · Las fotos salen de la base. En la versión anterior el carnet mostraba el
 *    archivo local del navegador, y **un blob no sobrevive una navegación**: después
 *    de volver de Mercado Pago los carnets aparecían sin foto.
 *
 * Sirve para las dos entradas —el alta gratuita y la vuelta del pago— con una sola
 * implementación, y sobrevive un refresh.
 */
export default async function AltaListo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(urls.landing);

  const [{ data: perfil }, { data: mascotas }] = await Promise.all([
    supabase.from('profiles').select('member_no, full_name, paid_until, mp_subscription_status, addon_odonto, plans(name)').eq('id', auth.user.id).maybeSingle(),
    supabase.from('pets').select('id, name, type, breed, age_years, weight_kg, microchip, photo_url').eq('owner_id', auth.user.id).order('created_at'),
  ]);
  // Sin perfil no hay alta que celebrar: la persona llegó acá de rebote.
  if (!perfil) redirect(urls.landing);

  const plan = Array.isArray(perfil.plans) ? perfil.plans[0] : perfil.plans;
  const debePagar = !perfil.paid_until || perfil.paid_until < hoyISO();
  const etiqueta = etiquetaPlan(plan?.name ?? null, debePagar);
  /*
   * "Esperando" es solo un cartel. Se enciende si eligió un plan y todavía no está
   * acreditado; lo que decide de verdad es `paid_until`, que escribe el webhook.
   */
  const esperando = !!plan && debePagar && q.pago !== 'error';
  const pagoFallado = q.pago === 'error';
  const varias = (mascotas?.length ?? 0) > 1;
  const nombre = perfil.full_name.split(' ')[0] ?? perfil.full_name;

  const ESPECIE: Record<string, string> = { perro: 'Perro', gato: 'Gato', otro: 'Otro' };

  return (
    <main style={{ minHeight: '100vh', background: '#f5f4f8', padding: '32px 20px 60px', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgb(33,30,51)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
          </div>
          <h1 style={{ fontFamily: '"Baloo 2", system-ui, sans-serif', fontWeight: 800, fontSize: 27, color: 'rgb(33,30,51)', margin: '0 0 8px' }}>
            ¡Bienvenido al club, {nombre}!
          </h1>
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgb(91,86,112)', margin: 0 }}>
            {perfil.member_no ? <>Sos el socio <strong>#{perfil.member_no}</strong>. </> : null}
            {varias ? 'Tus mascotas ya tienen su carnet digital.' : 'Tu mascota ya tiene su carnet digital.'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
          {(mascotas ?? []).map((m) => (
            <CarnetAlta
              key={m.id}
              nombre={m.name}
              especie={ESPECIE[m.type as string] ?? 'Otro'}
              raza={m.breed}
              edad={m.age_years}
              peso={m.weight_kg}
              microchip={m.microchip}
              fotoUrl={m.photo_url}
              etiqueta={etiqueta}
              memberNo={perfil.member_no}
            />
          ))}
        </div>

        {/* El aviso de la foto que no se pudo guardar viaja por la URL: la pantalla
            final es una ruta nueva, así que no puede leer el estado del formulario. */}
        {q.foto ? (
          <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 14 }}>
            {q.foto} {varias ? 'Las podés cargar' : 'La podés cargar'} cuando quieras desde el carnet.
          </div>
        ) : null}

        <AltaListoClient esperando={esperando} pagoFallado={pagoFallado} />

        {!plan ? (
          <p style={{ fontSize: 12.5, color: '#8781a0', textAlign: 'center', margin: '14px 0 0', lineHeight: 1.5 }}>
            Estás en el plan gratuito: tenés el carnet, las vacunas, los prestadores y los foros.
            Los reintegros y los beneficios se activan con cualquier plan, cuando quieras.
          </p>
        ) : null}
      </div>
    </main>
  );
}
