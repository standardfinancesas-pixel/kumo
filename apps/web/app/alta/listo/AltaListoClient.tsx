'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { APP_STORE, ESPERA_PAGO, PLAY_STORE, urls } from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';
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
export function AltaListoClient({ esperando, pagoFallado, activando }: { esperando: boolean; pagoFallado: boolean; activando: boolean }) {
  const router = useRouter();
  const [intentos, setIntentos] = useState(0);

  /*
   * Abrir la app YA LOGUEADO, para el que la acaba de instalar.
   *
   * La app es otra aplicación con su propio almacenamiento: la sesión del
   * navegador no viaja sola, así que sin esto el socio recién dado de alta abre
   * la app y tiene que escribir de nuevo el mail y la clave que acaba de crear.
   *
   * El traspaso va por el esquema `kumo://` con los tokens en el fragmento, que
   * es EXACTAMENTE la puerta que ya usa el ingreso con Google: la app lee
   * `access_token` y `refresh_token` y llama a `setSession` (ver lib/deepLink en
   * mobile). O sea que no hay nada que agregarle a la app.
   *
   * Lo que NO se puede es que sea automático —instalar, abrir y estar adentro—:
   * el link no sobrevive al paso por la tienda, y para eso haría falta deferred
   * deep linking, que es infraestructura de terceros. Por eso el botón dice "ya
   * la instalaste" en vez de aparecer solo.
   */
  const [enTelefono, setEnTelefono] = useState(false);
  const [noAbrio, setNoAbrio] = useState(false);
  useEffect(() => {
    // En una computadora el botón no haría nada, así que no se muestra.
    setEnTelefono(/android|iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  const abrirEnLaApp = async () => {
    setNoAbrio(false);
    const { data } = await supabase.auth.getSession();
    const sesion = data.session;
    if (!sesion) { window.location.href = urls.webapp; return; }
    /* En el FRAGMENTO y no en la query: es donde Supabase los pone y donde la app
       los busca, y además un fragmento no viaja a ningún servidor. */
    const destino = `kumo://auth#access_token=${encodeURIComponent(sesion.access_token)}&refresh_token=${encodeURIComponent(sesion.refresh_token)}`;
    /* Si la app no está instalada, el navegador simplemente no hace nada: no hay
       error que capturar. Por eso el aviso aparece a los 2 segundos, y se cancela
       si la pestaña se fue a segundo plano — que es lo que pasa cuando SÍ abrió. */
    const aviso = setTimeout(() => setNoAbrio(true), 2000);
    const cancelar = () => { if (document.hidden) clearTimeout(aviso); };
    document.addEventListener('visibilitychange', cancelar, { once: true });
    window.location.href = destino;
  };

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
        ) : activando ? (
          /*
           * La suscripción ya quedó autorizada, así que el cobro es un trámite entre Kumo
           * y Mercado Pago y no algo que el socio tenga que vigilar. Acá había un spinner
           * y "estamos confirmando tu pago", que se lee como "no entres todavía" — justo
           * lo contrario de lo que está pasando.
           */
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgb(240,247,241)', border: '1px solid rgb(214,235,220)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: 'rgb(47,143,91)', lineHeight: 1.5, marginBottom: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto', marginTop: 2 }}><path d="M4 12l5 5L20 6" /></svg>
            <span>
              <strong>Tu plan quedó activo.</strong> El primer cobro se acredita en un par de
              minutos y ahí aparecen los reintegros y los beneficios. No hace falta que hagas nada.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgb(240,237,249)', borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: 'rgb(93,84,145)', fontWeight: 600, marginBottom: 14 }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgb(93,84,145)', borderTopColor: 'transparent', animation: 'kspin 0.9s linear infinite', flex: '0 0 auto' }} />
            Estamos confirmando tu pago. Podés entrar mientras esperamos.
          </div>
        )
      ) : null}

      {/*
        * Las tiendas primero, el navegador después.
        *
        * Acá termina el alta, y el alta se hace casi siempre desde el teléfono: lo
        * que sigue naturalmente es instalar la app, no volver a una pestaña. Antes
        * el único botón llevaba a la webapp, así que el socio nuevo no se enteraba
        * de que la app existía hasta que alguien se lo dijera.
        *
        * El link del navegador SE QUEDA y bien visible: en Android la app todavía
        * no está publicada, y además esta pantalla es la que le dice al que está
        * esperando la confirmación del pago que puede entrar igual.
        */}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'rgb(135,129,160)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Descargá la app</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <a
          href={APP_STORE}
          target="_blank"
          rel="noopener noreferrer"
          style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'rgb(33,30,51)', color: '#fff', borderRadius: 14, padding: '12px 14px', textDecoration: 'none' }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M16 2c.1 1-.3 2-1 2.7-.7.8-1.8 1.4-2.8 1.3-.1-1 .4-2 1-2.7C13.9 2.5 15 2 16 2z" /><path d="M19.5 17c-.4 1-.6 1.4-1.1 2.3-.7 1.2-1.7 2.7-3 2.7-1.1 0-1.4-.7-2.9-.7s-1.9.7-3 .7c-1.3 0-2.2-1.3-3-2.5-2-3-2.2-6.5-1-8.4.9-1.4 2.3-2.2 3.6-2.2 1.3 0 2.2.8 3.3.8 1 0 1.7-.8 3.3-.8 1.1 0 2.3.6 3.2 1.7-2.8 1.5-2.4 5.4.6 6.4z" /></svg>
          <span style={{ lineHeight: 1.1 }}>
            <span style={{ display: 'block', fontSize: 9.5, color: 'rgb(201,195,227)' }}>Descargala en</span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>App Store</span>
          </span>
        </a>
        <a
          href={PLAY_STORE ?? urls.webapp}
          target={PLAY_STORE ? '_blank' : undefined}
          rel={PLAY_STORE ? 'noopener noreferrer' : undefined}
          style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'rgb(33,30,51)', color: '#fff', borderRadius: 14, padding: '12px 14px', textDecoration: 'none' }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3.5c-.3.2-.5.6-.5 1v15c0 .4.2.8.5 1l9-9.5-9-7.5z" fill="#5cc8ff" /><path d="M16.5 9 6 3c-.3-.2-.6-.2-.9-.1L14 12l2.5-3z" fill="#7be08a" /><path d="M16.5 15 6 21c-.3.2-.6.2-.9.1L14 12l2.5 3z" fill="#ff6b6b" /><path d="m16.5 9 4 2.3c.7.4.7 1.4 0 1.8L16.5 15 14 12l2.5-3z" fill="#ffd24d" /></svg>
          <span style={{ lineHeight: 1.1 }}>
            <span style={{ display: 'block', fontSize: 9.5, color: 'rgb(201,195,227)' }}>Disponible en</span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>Google Play</span>
          </span>
        </a>
      </div>

      {enTelefono && (
        <>
          <button
            type="button"
            onClick={abrirEnLaApp}
            style={{ display: 'block', width: '100%', textAlign: 'center', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontFamily: 'inherit', fontWeight: 700, fontSize: 15, padding: '14px 20px', border: 'none', borderRadius: 14, cursor: 'pointer', marginBottom: 10 }}
          >
            ¿Ya la instalaste? Abrila con tu sesión →
          </button>
          {noAbrio && (
            <div style={{ fontSize: 13, color: 'rgb(135,129,160)', lineHeight: 1.5, marginBottom: 10, textAlign: 'center' }}>
              No se abrió, así que todavía no la tenés instalada. Descargala arriba y volvé a tocar acá.
            </div>
          )}
        </>
      )}

      <a
        href={urls.webapp}
        style={{ display: 'block', textAlign: 'center', background: 'rgb(240,237,249)', color: 'rgb(93,84,145)', fontWeight: 700, fontSize: 15, padding: '14px 20px', borderRadius: 14, textDecoration: 'none' }}
      >
        O entrá desde el navegador →
      </a>
    </>
  );
}
