'use client';
import { useEffect, useState } from 'react';

/**
 * El puente del link de recuperar contraseña cuando el pedido salió de la app.
 *
 * El mail no puede linkear directo a `kumo://`: Supabase solo acepta destinos
 * `https` en la lista de redirects, y además un link con esquema propio no abre
 * nada si el socio lee el mail en la computadora. Así que el link va acá, y desde
 * acá se salta a la app — el mismo patrón que ya usa la vuelta de Mercado Pago
 * (`/suscripcion/listo`), probado en producción.
 *
 * Lo delicado es lo que hay que reenviar: Supabase pone la sesión en el FRAGMENTO
 * de la URL (`#access_token=…`), que nunca llega al servidor. Se reenvía tal cual,
 * sin interpretarlo, junto con la query — porque según el caso puede venir de una
 * forma o de la otra y la app sabe leer las dos.
 *
 * OJO: esta página NO puede instanciar el cliente de Supabase del navegador. Ese
 * cliente detecta la sesión en la URL y limpia el fragmento en cuanto arranca, así
 * que se llevaría justo lo que hay que reenviar. Acá no se habla con Supabase.
 */
export default function AbrirApp() {
  const [saltoFallado, setSaltoFallado] = useState(false);
  const [destino, setDestino] = useState('kumo://nueva-clave');

  useEffect(() => {
    const cola = window.location.hash || window.location.search || '';
    const url = `kumo://nueva-clave${cola}`;
    setDestino(url);
    // El intento automático. Si el navegador lo bloquea no hay error que capturar:
    // simplemente no pasa nada, y por eso a los 2 segundos aparece la alternativa.
    const t = setTimeout(() => { window.location.href = url; }, 400);
    const t2 = setTimeout(() => setSaltoFallado(true), 2400);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  /** La salida para quien abrió el mail en la computadora: la página de la web
   *  cambia la clave igual, y necesita el fragmento para tener sesión. */
  const enElNavegador = `/auth/nueva-clave${typeof window === 'undefined' ? '' : window.location.hash}`;

  return (
    <main style={{ minHeight: '100vh', background: '#f5f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '32px 28px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 14px 40px rgba(93,84,145,0.14)' }}>
        <div style={{ fontFamily: '"Baloo 2", system-ui, sans-serif', fontWeight: 800, fontSize: 26, color: 'rgb(93,84,145)', marginBottom: 14 }}>Kumo</div>
        <h1 style={{ fontFamily: '"Baloo 2", system-ui, sans-serif', fontWeight: 800, fontSize: 24, color: 'rgb(33,30,51)', margin: '0 0 10px' }}>
          {saltoFallado ? 'Elegí tu contraseña nueva' : 'Abriendo Kumo…'}
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgb(91,86,112)', margin: '0 0 22px' }}>
          {saltoFallado
            ? 'Tocá el botón para terminar en la app.'
            : 'Te estamos llevando a la app para que elijas la contraseña nueva.'}
        </p>
        <a
          href={destino}
          style={{ display: 'block', background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 15.5, padding: '15px 20px', borderRadius: 14, textDecoration: 'none' }}
        >
          Abrir Kumo
        </a>
        <a
          href={enElNavegador}
          style={{ display: 'inline-block', marginTop: 16, fontSize: 13.5, color: 'rgb(93,84,145)', fontWeight: 700, textDecoration: 'none' }}
        >
          Cambiala en el navegador
        </a>
        <p style={{ fontSize: 12.5, color: '#a29dba', margin: '16px 0 0', lineHeight: 1.5 }}>
          El link vence en una hora y sirve una sola vez.
        </p>
      </div>
    </main>
  );
}
