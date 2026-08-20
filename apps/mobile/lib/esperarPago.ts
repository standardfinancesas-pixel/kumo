import { useEffect, useRef, useState } from 'react';
import { ESPERA_PAGO } from '@kumo/shared';
import { confirmarSuscripcion } from './api';

/**
 * La espera del cobro, después de que el socio autoriza en Mercado Pago.
 *
 * Le PREGUNTA a Mercado Pago en vez de esperar su aviso, y la primera vuelta va sin
 * demora: medido contra la cuenta real, MP debita 18 segundos después de autorizar
 * pero su aviso llegó 1:41 más tarde. O sea que cuando el socio vuelve a la app el
 * cobro ya existe, y preguntando se resuelve en el acto.
 *
 * Las vueltas siguientes son para el que autorizó y volvió antes de que MP debitara:
 * escalonadas y con límite (`ESPERA_PAGO`, el mismo presupuesto que usa la web).
 *
 * `recargar` va en una ref a propósito: es una función que cambia en cada render de
 * la pantalla, y puesta en las dependencias del efecto lo haría re-armarse solo,
 * pidiendo a Mercado Pago en un bucle.
 */
export function useEsperarPago(activo: boolean, recargar: () => void): { seAgoto: boolean } {
  const [intentos, setIntentos] = useState(0);
  const refRecargar = useRef(recargar);
  refRecargar.current = recargar;

  useEffect(() => {
    if (!activo || intentos >= ESPERA_PAGO.limite) return;
    const espera = intentos === 0
      ? 0
      : intentos < ESPERA_PAGO.rapidos ? ESPERA_PAGO.msRapido : ESPERA_PAGO.msLento;
    let vivo = true;
    const t = setTimeout(async () => {
      await confirmarSuscripcion();
      if (!vivo) return;
      setIntentos((n) => n + 1);
      refRecargar.current();
    }, espera);
    return () => { vivo = false; clearTimeout(t); };
  }, [activo, intentos]);

  return { seAgoto: intentos >= ESPERA_PAGO.limite };
}
