import { TouchableOpacity, View } from 'react-native';
import { colors, cuotaMensual, ODONTO_PRECIO } from '@kumo/shared';
import { Texto as Text, BRAND, INK, LIME, MUTED } from '../ui/Texto';
import { Punto, Tilde } from '../ui/Controles';

/** Lo que la app necesita saber de un plan. Sale de la base, no del código. */
export type PlanAlta = { id: string; name: string; basePrice: number; tagline: string; perks: string[]; featured: boolean };

const plata = (n: number) => '$' + n.toLocaleString('es-AR');

/**
 * Paso 3 · El plan.
 *
 * La bajada y los beneficios salen de la tabla `plans`, que es lo que el club edita
 * desde el panel. La web todavía muestra un texto congelado en el código para esto
 * y le pasa por encima a lo que el club escribió; acá no se repite ese error.
 *
 * La cobertura odontológica va UNA sola vez, debajo de la lista, y no dentro de
 * cada tarjeta: es una columna del socio (`addon_odonto`), no del plan. Cuando el
 * check vivía dentro de las tarjetas parecía ser de ese plan, y tildarlo en uno lo
 * tildaba en todos.
 */
export default function Paso3Plan({
  planes, elegido, odonto, onPlan, onOdonto,
}: {
  planes: PlanAlta[];
  elegido: string | null;
  odonto: boolean;
  onPlan: (nombre: string) => void;
  onOdonto: (v: boolean) => void;
}) {
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
              onPress={() => onPlan(p.name)}
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

      <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: colors.violet[50], borderRadius: 12, padding: 14, marginTop: 16 }}>
        <Tilde marcado={odonto} onCambio={onOdonto}>
          <Text style={{ fontSize: 13.5, color: '#5b5670' }}>
            ¿Sumar cobertura odontológica? <Text style={{ fontWeight: '700', color: INK }}>+{plata(ODONTO_PRECIO)}/mes</Text>
          </Text>
        </Tilde>
      </View>

      {elegido ? (
        <View style={{ backgroundColor: BRAND, borderRadius: 14, padding: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Tu cuota mensual</Text>
          <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 22, color: LIME }}>
            {plata(cuotaMensual(planes.find((p) => p.name === elegido)?.basePrice ?? 0, odonto))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
