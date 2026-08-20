'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESPERA_PAGO, urls } from '@kumo/shared';
import { confirmarPago } from '@/lib/confirmarPago';

/**
 * La parte viva de la pantalla final: confirmar el pago.
 *
 * Lo importante es lo que NO hace: no bloquea nada. El socio ya es socio, así que
 * "Ir a la app" está habilitado siempre y esto es solo un cartel que se actualiza.
 *
 * Y no decide nada: pide a `/api/pagos/confirmar`, que consulta la API de Mercado
 * Pago con el token y acredita si hay un cobro aprobado de verdad. Los parámetros de
 * la URL de vuelta no dan acceso —los puede tipear cualquiera—, solo sirven para
 * saber a qué suscripción preguntarle.
 */
export function AltaListoClient({ esperando, pagoFallado }: { esperando: boolean; pagoFallado: boolean }) {
  const router = useRouter();
  const [intentos, setIntentos] = useState(0);

  /*
   * Cada pasada le PREGUNTA a Mercado Pago en vez de esperar que avise.
   *
   * La primera va sin demora, y ahí se resuelve el caso normal: medido contra la
   * cuenta real, MP debita 18 segundos después de autorizar, así que cuando el socio
   * vuelve el cobro ya existe — lo que tardaba 2 minutos era el aviso, no la plata.
   * Sondear la base sola no alcanzaba: la base no cambia hasta que llega el aviso.
   *
   * Las pasadas siguientes cubren al que autorizó y volvió antes de que MP debitara.
   * Sigue escalonado y con límite (`ESPERA_PAGO`), y sigue sin bloquear nada: el socio
   * ya está adentro.
   */
  useEffect(() => {
    if (!esperando || intentos >= ESPERA_PAGO.limite) return;
    const espera = intentos === 0
      ? 0
      : intentos < ESPERA_PAGO.rapidos ? ESPERA_PAGO.msRapido : ESPERA_PAGO.msLento;
    let vivo = true;
    const t = setTimeout(async () => {
      await confirmarPago();
      if (!vivo) return;
      setIntentos((n) => n + 1);
      router.refresh();
    }, espera);
    return () => { vivo = false; clearTimeout(t); };
  }, [esperando, intentos, router]);

  const seAgoto = intentos >= ESPERA_PAGO.limite;

  return (
    <>
      {pagoFallado ? (
        <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 14 }}>
          {/* Que falle el cobro no puede parecer un alta fallida: el socio ya existe. */}
          Tu cuenta ya está creada, pero no pudimos activar la cuota. Podés activarla
          desde <strong>Mi perfil</strong> cuando quieras — tus mascotas ya tienen carnet.
        </div>
      ) : esperando ? (
        seAgoto ? (
          <div style={{ background: 'rgb(251,243,226)', color: 'rgb(146,105,10)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 14 }}>
            Está tardando más de lo normal. Si ya autorizaste el pago, se activa solo en cuanto Mercado Pago lo cobre: <strong>no hace falta pagar de nuevo</strong>.
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgb(240,237,249)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: 'rgb(93,84,145)', fontWeight: 600, marginBottom: 14 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgb(93,84,145)', borderTopColor: 'transparent', animation: 'kspin 0.9s linear infinite', flex: '0 0 auto' }} />
            Estamos confirmando tu pago. Podés entrar mientras esperamos.
          </div>
        )
      ) : null}

      <a
        href={urls.webapp}
        style={{ display: 'block', textAlign: 'center', background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 14, textDecoration: 'none' }}
      >
        Ir a la app →
      </a>
    </>
  );
}
