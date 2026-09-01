import { View } from 'react-native';
import type { selloCarnet } from '@kumo/shared';
import { Texto as Text, INK, LIME } from './Texto';

/** Lo que devuelve `selloCarnet`, tomado de ahí y no copiado: si el helper suma un
 *  tono, este componente se rompe en el typecheck en vez de pintarlo mal. */
type Sello = ReturnType<typeof selloCarnet>;

/**
 * El sello del carnet: ACTIVO · GRATUITO · ACTIVANDO · CUOTA VENCIDA.
 *
 * Existe porque estaba escrito a mano en dos lugares y en uno de ellos decía
 * "ACTIVO" fijo: la tarjeta de la mascota mostraba ACTIVO **incluso a un socio
 * gratuito**, mientras la webapp —que sí usa `selloCarnet`— decía GRATUITO. O sea
 * que la misma cuenta se leía distinta en cada superficie, y la que mentía era la
 * app. El texto y el tono los decide `selloCarnet` de @kumo/shared, que es la única
 * fuente: acá solo se pintan.
 *
 * Los tonos son los mismos que el `SelloCarnet` de la web, y están pensados para
 * fondo violeta (el sello vive arriba de la tarjeta del carnet).
 */
export function SelloCarnet({ sello }: { sello: Sello }) {
  const fondo = sello.tono === 'ok' ? LIME : sello.tono === 'alerta' ? '#fbe8ef' : 'rgba(255,255,255,0.18)';
  const tinta = sello.tono === 'ok' ? INK : sello.tono === 'alerta' ? '#c14d7a' : '#fff';
  return (
    /* En una sola línea SIEMPRE: "CUOTA PENDIENTE" es más ancho que la foto del
       carnet y se partía en dos renglones, saliéndose de la píldora. La webapp no
       lo sufre porque su equivalente ya usa `white-space: nowrap`. */
    <View style={{ backgroundColor: fondo, borderRadius: 100, paddingVertical: 4, paddingHorizontal: 9 }}>
      <Text numberOfLines={1} style={{ color: tinta, fontWeight: '800', fontSize: 10 }}>{sello.texto}</Text>
    </View>
  );
}
