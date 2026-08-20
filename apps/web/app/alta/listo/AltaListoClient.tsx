'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESPERA_PAGO, urls } from '@kumo/shared';

/**
 * La parte viva de la pantalla final: esperar el aviso de Mercado Pago.
 *
 * Lo importante es lo que NO hace: no bloquea nada. El socio ya es socio, así que
 * "Ir a la app" está habilitado siempre y esto es solo un cartel que se actualiza.
 * El acceso lo da el aviso a `/api/pagos/webhook`, nunca esta pantalla ni la URL de
 * vuelta —los parámetros de una URL los puede tipear cualquiera—.
 *
 * La ventana es de 3 minutos porque está medido: el 19/08, con una suscripción real,
 * Mercado Pago debitó a los 18 segundos y su aviso llegó 1:41 después.
 */
export function AltaListoClient({ esperando, pagoFallado }: { esperando: boolean; pagoFallado: boolean }) {
  const router = useRouter();
  const [intentos, setIntentos] = useState(0);

  useEffect(() => {
    if (!esperando || intentos >= ESPERA_PAGO.limite) return;
    const espera = intentos < ESPERA_PAGO.rapidos ? ESPERA_PAGO.msRapido : ESPERA_PAGO.msLento;
    const t = setTimeout(() => { setIntentos((n) => n + 1); router.refresh(); }, espera);
    return () => clearTimeout(t);
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
            Está tardando más de lo normal. Si ya autorizaste el pago, se activa solo cuando Mercado Pago nos confirme: <strong>no hace falta pagar de nuevo</strong>.
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
