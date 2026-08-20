'use client';
import { useEffect, useState } from 'react';
import { urls, claveValida } from '@kumo/shared';
import { supabase } from '@/lib/supabase-browser';
import { CampoClave } from '@/components/CampoClave';

/**
 * Elegir una contraseña nueva, al final del link del mail.
 *
 * Cómo llega hasta acá: el mail lleva a `/auth/callback`, que canjea el código por
 * una sesión y redirige a esta página. O sea que quien la ve ya está identificado
 * —por eso alcanza con `updateUser`— y quien no tenga esa sesión no puede cambiarle
 * la contraseña a nadie.
 *
 * Es una página aparte y no un modal a propósito: se entra desde el cliente de
 * mail, sin nada de la landing cargado atrás.
 */
export default function NuevaClave() {
  const [clave, setClave] = useState('');
  const [repetida, setRepetida] = useState('');
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'sin-sesion' | 'guardando' | 'ok'>('cargando');
  const [error, setError] = useState('');

  /*
   * ¿El link sirvió? Si no hay sesión, el token venció (dura una hora), ya se usó,
   * o alguien entró a esta URL de rebote. Se lo dice en lugar de mostrarle un
   * formulario que va a fallar cuando ya eligió la contraseña.
   */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEstado(data.session ? 'lista' : 'sin-sesion'));
  }, []);

  const corta = clave.length > 0 && !claveValida(clave);
  const distintas = repetida.length > 0 && clave !== repetida;
  const puede = claveValida(clave) && clave === repetida;

  const guardar = async () => {
    if (!puede) return;
    setEstado('guardando'); setError('');
    const { error: e } = await supabase.auth.updateUser({ password: clave });
    if (e) {
      // El caso típico: el link ya se usó o venció mientras completaba.
      setError(/expired|invalid|session/i.test(e.message)
        ? 'El link ya venció o se usó. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".'
        : 'No pudimos guardar la contraseña. Probá de nuevo.');
      setEstado('lista');
      return;
    }
    setEstado('ok');
    // Con la contraseña cambiada la sesión ya es válida: entra derecho.
    setTimeout(() => { window.location.href = urls.webapp; }, 1200);
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '13px 15px', border: '1.5px solid rgb(217,208,238)', borderRadius: 12,
    fontSize: 15, background: 'rgb(250,249,253)', color: 'rgb(33,30,51)', outline: 'none', fontFamily: '"DM Sans"',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 700, color: '#8781a0', marginBottom: 7 };

  return (
    <main style={{ minHeight: '100vh', background: '#f5f4f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '30px 28px', maxWidth: 420, width: '100%', boxShadow: '0 14px 40px rgba(93,84,145,0.14)' }}>
        <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26, color: 'rgb(93,84,145)', marginBottom: 6 }}>Kumo</div>

        {estado === 'cargando' && <p style={{ fontSize: 14.5, color: 'rgb(91,86,112)' }}>Un segundo…</p>}

        {estado === 'sin-sesion' && (
          <>
            <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 23, color: 'rgb(33,30,51)', margin: '0 0 10px' }}>El link ya no sirve</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgb(91,86,112)', margin: '0 0 20px' }}>
              Los links para cambiar la contraseña duran una hora y se usan una sola vez. Pedí uno nuevo y te llega otro mail.
            </p>
            <a href={`${urls.landing}?recuperar=1`} style={{ display: 'block', textAlign: 'center', background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 15, padding: '14px 20px', borderRadius: 13, textDecoration: 'none' }}>
              Pedir otro link
            </a>
          </>
        )}

        {estado === 'ok' && (
          <>
            <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 23, color: 'rgb(33,30,51)', margin: '0 0 10px' }}>¡Listo!</h1>
            <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'rgb(91,86,112)', margin: 0 }}>Cambiamos tu contraseña y te estamos haciendo entrar…</p>
          </>
        )}

        {(estado === 'lista' || estado === 'guardando') && (
          <>
            <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 23, color: 'rgb(33,30,51)', margin: '0 0 6px' }}>Elegí tu contraseña nueva</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: '#8781a0', margin: '0 0 20px' }}>Con esta vas a entrar a la app y a la web.</p>

            <label style={label} htmlFor="clave">CONTRASEÑA NUEVA</label>
            {/* El ojito y los requisitos los pone `CampoClave`: es el mismo campo que
                el del alta, y la regla es la misma (`chequeosClave` de shared). Antes
                acá se pedían 6 caracteres y en el alta otra cosa. */}
            <div style={{ marginBottom: 14 }}>
              <CampoClave id="clave" value={clave} onChange={setClave} style={inp} mal={corta} />
            </div>

            <label style={label} htmlFor="repetida">REPETILA</label>
            <div style={{ marginBottom: distintas ? 6 : 14 }}>
              <CampoClave id="repetida" value={repetida} onChange={setRepetida} requisitos={false} style={inp} mal={distintas} />
            </div>
            {distintas && <div style={{ fontSize: 12.5, color: 'rgb(176,58,58)', marginBottom: 10 }}>Las dos no coinciden.</div>}

            {!!error && (
              <div style={{ background: 'rgb(253,242,242)', color: 'rgb(176,58,58)', border: '1px solid rgb(245,214,214)', borderRadius: 12, padding: '11px 13px', fontSize: 13.5, marginBottom: 14 }}>{error}</div>
            )}

            <button
              onClick={guardar}
              disabled={!puede || estado === 'guardando'}
              style={{ width: '100%', background: 'rgb(93,84,145)', color: '#fff', border: 'none', fontFamily: '"DM Sans"', fontWeight: 700, fontSize: 15.5, padding: '14px 20px', borderRadius: 13, cursor: puede ? 'pointer' : 'default', opacity: puede && estado !== 'guardando' ? 1 : 0.55 }}
            >
              {estado === 'guardando' ? 'Guardando…' : 'Guardar y entrar'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
