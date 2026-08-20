import { View } from 'react-native';
import { colors } from '@kumo/shared';
import { Texto as Text, INK, LIME, MUTED, BRAND } from '../ui/Texto';

const plata = (n: number) => '$' + n.toLocaleString('es-AR');

/**
 * Paso 5 · La cuota. Solo existe si eligió un plan.
 *
 * Ya no se piden ni la tarjeta ni el CBU:
 *
 *  · La tarjeta se tipea en el sitio de Mercado Pago, así que no pasa por Kumo y no
 *    hay nada que podamos filtrar ni obligaciones de PCI DSS que cumplir.
 *  · El CBU era para los REINTEGROS, no para cobrar la cuota. Se pide al cargar el
 *    primer reintegro, que es cuando recién hace falta — y ahí el formulario ya lo
 *    guarda en el perfil para no volver a pedirlo.
 *
 * Lo único que queda son las condiciones, que se aceptan tocando el botón.
 */
export default function Paso5Cuota({
  plan, odonto, cuota,
}: {
  plan: string;
  odonto: boolean;
  cuota: number;
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Tu cuota</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Incluye IVA. Sin permanencia.</Text>

      <View style={{ backgroundColor: BRAND, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <View>
          <Text style={{ color: '#c9c3e3', fontSize: 13 }}>Plan {plan}{odonto ? ' + odontológica' : ''}</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cuota mensual</Text>
        </View>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: LIME }}>{plata(cuota)}</Text>
      </View>

      <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: colors.violet[50], borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontWeight: '700', fontSize: 14.5, color: INK, marginBottom: 6 }}>Vas a pagar con Mercado Pago</Text>
        <Text style={{ fontSize: 13, color: '#5b5670', lineHeight: 19 }}>
          Al confirmar te llevamos a Mercado Pago para autorizar el débito automático. Los datos de tu
          tarjeta no pasan por Kumo, y podés darlo de baja cuando quieras desde Mi perfil.
        </Text>
      </View>

      {/* Las condiciones a la vista, sin tilde: el gesto de aceptar es tocar el botón
          de abajo. El texto tiene que quedar siempre —es lo que hace que la aceptación
          valga—, el tilde era un toque más entre el socio y el pago. */}
      <Text style={{ fontSize: 12.5, color: MUTED, lineHeight: 18 }}>
        Al continuar aceptás el contrato de membresía: la cuota se actualiza cada 3 meses según IPC y los plazos de carencia son de 60, 90 y 180 días. Tenés 10 días de arrepentimiento (Ley 24.240).
      </Text>
    </View>
  );
}
