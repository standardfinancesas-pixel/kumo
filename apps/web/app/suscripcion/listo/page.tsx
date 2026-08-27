'use client';
import { useEffect, useState } from 'react';

/**
 * La vuelta de Mercado Pago cuando el socio pagó DESDE LA APP: lo devuelve a la app.
 *
 * Antes el `back_url` iba a `/app`, y en el navegador del teléfono eso no funciona:
 * la sesión vive en la app, así que la webapp lo rebotaba a la portada y el socio
 * terminaba mirando la landing sin saber si el pago salió bien.
 *
 * Acá se intenta abrir la app sola, por su esquema (`kumo://`, declarado en
 * app.json). El botón queda igual, y no es adorno: hay navegadores que sólo abren
 * otra app si la persona toca algo, así que cuando el salto automático no sale, el
 * botón es la salida. Por eso el texto no promete nada: dice qué está pasando.
 *
 * Esta pantalla no lee ni escribe nada, y no hace falta: el acceso lo da el aviso
 * de Mercado Pago a `/api/pagos/webhook`, nunca esta página.
 */
export default function SuscripcionListo() {
  const [saltoFallado, setSaltoFallado] = useState(false);
  /*
   * El `preapproval_id` que Mercado Pago agrega a esta URL VIAJA a la app dentro
   * del deep link, y no es un adorno: con el cobro por plan, el perfil no conoce
   * la suscripción hasta que llega el webhook (~25 segundos medidos). La web se
   * confirma sola porque manda este id a /api/pagos/confirmar; la app lo tiraba
   * acá —el link era `kumo://` pelado— y volvía ciega: recargaba desde la base,
   * la base todavía no sabía nada, y el socio veía su plan inactivo hasta
   * refrescar a mano. Con el id adentro, la app confirma contra Mercado Pago en
   * el acto, igual que la web.
   */
  const [linkApp, setLinkApp] = useState('kumo://pago');

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('preapproval_id');
    const destino = id ? `kumo://pago?preapproval_id=${encodeURIComponent(id)}` : 'kumo://pago';
    setLinkApp(destino);
    // El intento automático. Si el navegador lo bloquea no hay error que capturar:
    // simplemente no pasa nada, y por eso a los 2 segundos se muestra el botón.
    const t = setTimeout(() => { window.location.href = destino; }, 400);
    const t2 = setTimeout(() => setSaltoFallado(true), 2400);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  return (
    <main style={{ minHeight: '100vh', background: '#f5f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '32px 28px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 14px 40px rgba(93,84,145,0.14)' }}>
        <div style={{ fontFamily: '"Baloo 2", system-ui, sans-serif', fontWeight: 800, fontSize: 26, color: 'rgb(93,84,145)', marginBottom: 14 }}>Kumo</div>
        <div style={{ width: 62, height: 62, borderRadius: '50%', background: 'rgb(225,251,98)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgb(33,30,51)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
        </div>
        <h1 style={{ fontFamily: '"Baloo 2", system-ui, sans-serif', fontWeight: 800, fontSize: 24, color: 'rgb(33,30,51)', margin: '0 0 10px' }}>
          {saltoFallado ? '¡Listo!' : 'Volviendo a Kumo…'}
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgb(91,86,112)', margin: '0 0 8px' }}>
          {saltoFallado ? 'Tocá el botón para volver a la app.' : 'Te estamos llevando de nuevo a la app.'}
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, color: '#8781a0', margin: '0 0 22px' }}>
          Tu acceso se activa en cuanto Mercado Pago nos confirme el pago. Si tarda un momento, <strong>no hace falta pagar de nuevo</strong>.
        </p>
        <a
          href={linkApp}
          style={{ display: 'block', background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 14, textDecoration: 'none' }}
        >
          Abrir Kumo
        </a>
        {saltoFallado && (
          <p style={{ fontSize: 12.5, color: '#a29dba', margin: '14px 0 0', lineHeight: 1.5 }}>
            Si el botón no hace nada, cerrá esta pestaña y abrí la app desde el teléfono.
          </p>
        )}
      </div>
    </main>
  );
}
