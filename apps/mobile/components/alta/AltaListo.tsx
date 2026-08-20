import { useEffect, useState } from 'react';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { colors, etiquetaPlan, selloCarnet } from '@kumo/shared';
import { crearSuscripcion } from '../../lib/api';
import { useEsperarPago } from '../../lib/esperarPago';
import { Texto as Text, BRAND, INK, LIME, MUTED } from '../ui/Texto';

/** Lo mínimo de una mascota para dibujar su carnet. Sale de los datos ya cargados. */
export type MascotaListo = { id: string; nombre: string; especie: string; raza?: string | null; edad?: string | null; peso?: string | null };

/**
 * "¡Bienvenido al club!" — la última pantalla del alta, en la app.
 *
 * Vive acá arriba y no dentro del formulario por una razón concreta: para pagar hace
 * falta la sesión, y abrir la sesión hace que `App.tsx` cambie de árbol y desmonte el
 * alta. Si esta pantalla viviera adentro, no se vería nunca.
 *
 * Como está afuera, además sobrevive el viaje al navegador de Mercado Pago: al volver,
 * la app recarga sola (AppState) y esto sigue en pie.
 */
export default function AltaListo({
  memberNo, avisoFoto, pagar, mascotas, planName, debePagar, onEntrar, recargar,
}: {
  memberNo: number;
  avisoFoto: string | null;
  /** El plan elegido, si eligió uno. Null = alta gratuita. */
  pagar: { plan: string; odonto: boolean } | null;
  mascotas: MascotaListo[];
  planName: string | null;
  debePagar: boolean;
  onEntrar: () => void;
  recargar: () => void;
}) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState('');
  const [fueAMP, setFueAMP] = useState(false);

  /*
   * Si eligió un plan, se abre el cobro solo: ya aceptó las condiciones en el paso 5,
   * y hacerle tocar otro botón para lo mismo es una fricción sin sentido.
   *
   * Si el cobro falla NO se pierde el alta: el socio ya existe y se le dice que puede
   * activar la cuota después. Que falle el pago nunca puede parecer un alta fallida.
   */
  useEffect(() => {
    if (!pagar || fueAMP) return;
    let vivo = true;
    (async () => {
      setYendo(true);
      const r = await crearSuscripcion({ ...pagar, desde: 'alta' });
      if (!vivo) return;
      setYendo(false);
      setFueAMP(true);
      if ('ok' in r) { await Linking.openURL(r.initPoint); return; }
      if ('yaAutorizada' in r) { recargar(); return; }
      /* En el alta no puede haber una suscripción vieja que actualizar, pero el tipo
         la contempla: se trata igual que "ya autorizada" en vez de ignorarla. */
      if ('actualizada' in r) { recargar(); return; }
      setError(r.error);
    })();
    return () => { vivo = false; };
  }, [pagar, fueAMP, recargar]);

  /* Volvió de Mercado Pago: se le pregunta por el cobro en vez de esperar el aviso,
     que es lo que hacía que el carnet apareciera con la cuota "confirmando" un par de
     minutos después de que el socio ya había pagado. */
  useEsperarPago(fueAMP && debePagar, recargar);

  const etiqueta = etiquetaPlan(planName, debePagar);
  /* El sello decía ACTIVO escrito a mano, incluso para un socio gratuito. */
  /* Sin `cuotaHasta` porque un alta recién hecha nunca tuvo un vencimiento, y con la
     suscripción autorizada el sello dice ACTIVANDO en vez de acusar una deuda. `fueAMP`
     alcanza como señal: si lo mandamos a pagar, la suscripción quedó creada. */
  const sello = selloCarnet({
    debePagar,
    tienePlan: !!planName && planName !== '—',
    suscripcion: fueAMP ? 'authorized' : null,
  });
  const varias = mascotas.length > 1;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#f5f4f8', zIndex: 120 }}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 56, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 30, color: INK, fontWeight: '800' }}>✓</Text>
          </View>
          <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, textAlign: 'center' }}>¡Bienvenido al club!</Text>
          <Text style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
            {memberNo ? `Sos el socio #${memberNo}. ` : ''}
            {varias ? 'Tus mascotas ya tienen su carnet digital.' : 'Tu mascota ya tiene su carnet digital.'}
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          {mascotas.map((m) => (
            <View key={m.id} style={{ backgroundColor: BRAND, borderRadius: 18, padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#c9c3e3', fontSize: 12, fontWeight: '700' }}>{etiqueta.toUpperCase()}</Text>
                <View style={{ backgroundColor: sello.tono === 'ok' ? LIME : sello.tono === 'alerta' ? '#fbe8ef' : 'rgba(255,255,255,0.18)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: sello.tono === 'ok' ? INK : sello.tono === 'alerta' ? '#c14d7a' : '#fff' }}>{sello.texto}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 22, color: '#fff' }}>{m.nombre}</Text>
              <Text style={{ color: '#c9c3e3', fontSize: 13, marginTop: 2 }}>
                {[m.especie, m.raza, m.edad, m.peso].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ))}
        </View>

        {avisoFoto ? (
          <View style={{ backgroundColor: 'rgb(251,243,226)', borderRadius: 12, padding: 14, marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgb(146,105,10)', lineHeight: 19 }}>
              {avisoFoto} {varias ? 'Las podés cargar' : 'La podés cargar'} cuando quieras desde el carnet.
            </Text>
          </View>
        ) : null}

        {yendo ? (
          <View style={{ backgroundColor: colors.violet[50], borderRadius: 12, padding: 14, marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: BRAND, fontWeight: '600' }}>Abriendo Mercado Pago…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={{ backgroundColor: 'rgb(251,243,226)', borderRadius: 12, padding: 14, marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgb(146,105,10)', lineHeight: 19 }}>
              Tu cuenta ya está creada, pero no pudimos activar la cuota: {error} La podés activar desde Mi perfil cuando quieras.
            </Text>
          </View>
        ) : null}

        {!pagar ? (
          <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
            Estás en el plan gratuito: tenés el carnet, las vacunas, los prestadores y los foros.
            Los reintegros y los beneficios se activan con cualquier plan, cuando quieras.
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={onEntrar}
          style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Entrar a la app</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
