import { TouchableOpacity, View } from 'react-native';
import { colors, cuotaMensual, ODONTO_PRECIO, esGratis, planElegido, type EleccionPlan } from '@kumo/shared';
import { Texto as Text, BRAND, INK, LIME, MUTED } from '../ui/Texto';
import { Punto, Tilde } from '../ui/Controles';

/** Lo que la app necesita saber de un plan. Sale de la base, no del código. */
export type PlanAlta = { id: string; name: string; basePrice: number; tagline: string; perks: string[]; featured: boolean };

const plata = (n: number) => '$' + n.toLocaleString('es-AR');

/**
 * Paso 3 · El plan, o entrar gratis.
 *
 * La bajada y los beneficios salen de la tabla `plans`, que es lo que el club edita
 * desde el panel.
 *
 * "Continuar gratis" va abajo y con menos jerarquía que las tarjetas, a propósito: la
 * web pública vende tres planes, y si esto compitiera visualmente el formulario
 * vendería cuatro. Es la salida para quien duda, no una opción más.
 *
 * La cobertura odontológica va UNA sola vez y solo con un plan elegido: es una
 * columna del socio (`addon_odonto`), no del plan, y sin cuota no hay dónde cobrarla.
 */
export default function Paso3Plan({
  planes, eleccion, odonto, onEleccion, onOdonto,
}: {
  planes: PlanAlta[];
  eleccion: EleccionPlan | null;
  odonto: boolean;
  onEleccion: (e: EleccionPlan) => void;
  onOdonto: (v: boolean) => void;
}) {
  const gratis = esGratis(eleccion);
  const elegido = planElegido(eleccion);

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Elegí tu plan</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Podés cambiarlo o cancelarlo cuando quieras.</Text>

      <View style={{ gap: 14 }}>
        {planes.map((p) => {
          const on = elegido === p.name;
          return (
            <TouchableOpacity
              key={p.id}
              onPress={() => onEleccion({ modo: 'pago', plan: p.name, aceptaCuota: true })}
              style={{ borderWidth: 2, borderColor: on ? BRAND : colors.violet[200], backgroundColor: on ? colors.violet[50] : '#fff', borderRadius: 18, padding: 18 }}
            >
              {p.featured ? (
                <View style={{ position: 'absolute', top: -11, left: 18, backgroundColor: LIME, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: INK }}>MÁS ELEGIDO</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 18, color: BRAND }}>{p.name}</Text>
                <Punto on={on} />
              </View>
              <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 22, color: INK, marginTop: 4 }}>
                {plata(p.basePrice)}<Text style={{ fontSize: 13, color: MUTED, fontWeight: '500' }}>/mes</Text>
              </Text>
              {p.tagline ? <Text style={{ fontSize: 13.5, color: '#5b5670', marginTop: 4 }}>{p.tagline}</Text> : null}
              <View style={{ gap: 6, marginTop: 12 }}>
                {p.perks.map((perk) => (
                  <View key={perk} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: BRAND, fontWeight: '800', fontSize: 13 }}>✓</Text>
                    <Text style={{ fontSize: 13, color: '#4a4560', flex: 1 }}>{perk}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {elegido ? (
        <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: colors.violet[50], borderRadius: 12, padding: 14, marginTop: 16 }}>
          <Tilde marcado={odonto} onCambio={onOdonto}>
            <Text style={{ fontSize: 13.5, color: '#5b5670' }}>
              ¿Sumar cobertura odontológica? <Text style={{ fontWeight: '700', color: INK }}>+{plata(ODONTO_PRECIO)}/mes</Text>
            </Text>
          </Tilde>
        </View>
      ) : null}

      {elegido ? (
        <View style={{ backgroundColor: BRAND, borderRadius: 14, padding: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Tu cuota mensual</Text>
          <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 22, color: LIME }}>
            {plata(cuotaMensual(planes.find((p) => p.name === elegido)?.basePrice ?? 0, odonto))}
          </Text>
        </View>
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.violet[200], marginTop: 22, paddingTop: 18 }}>
        <TouchableOpacity
          onPress={() => onEleccion({ modo: 'gratis' })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: gratis ? BRAND : colors.violet[200], backgroundColor: gratis ? colors.violet[50] : '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: INK }}>Continuar gratis</Text>
            <Text style={{ fontSize: 13, color: MUTED, marginTop: 2, lineHeight: 19 }}>
              Tenés el carnet de tus mascotas, las vacunas, los prestadores y los foros. Los reintegros y los beneficios se activan con un plan, cuando quieras.
            </Text>
          </View>
          <Punto on={gratis} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
