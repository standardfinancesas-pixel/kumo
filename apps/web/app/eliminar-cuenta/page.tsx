import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import { data, waLink, urls } from '@kumo/shared';
import { createClient } from '@/lib/supabase-public';

/*
 * Página pública de eliminación de cuenta.
 *
 * Existe por dos motivos que piden lo mismo desde lados distintos: el derecho de
 * supresión de la Ley 25.326, y Google Play, que para publicar exige una URL
 * accesible SIN iniciar sesión donde se explique cómo borrar la cuenta. Esa URL
 * es la que se carga en el formulario de "Seguridad de los datos" del Play
 * Console, así que esta página no puede quedar detrás del login ni depender de
 * que el socio recuerde su contraseña — justamente el caso de quien ya no puede
 * entrar y quiere que le borren los datos.
 *
 * Va como página propia y no como una sección de /legal: Google pide una URL que
 * hable de esto y nada más, y un ancla dentro de un documento largo hace que la
 * persona caiga en medio de los términos y condiciones.
 *
 * El contacto sale de `club_settings`, como /legal y la landing, y no escrito a
 * mano: es la vía por la que se ejerce el derecho, y una dirección desactualizada
 * es peor que no ofrecer ninguna.
 */

export const metadata: Metadata = {
  title: 'Eliminar tu cuenta · Kumo',
  description: 'Cómo eliminar tu cuenta de Kumo y qué datos se borran.',
};

/** Igual que la landing y /legal: se revalida cada minuto, así el cambio del admin llega. */
export const revalidate = 60;

const h2: CSSProperties = { fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: 'rgb(33,30,51)', margin: '0 0 12px' };
const p: CSSProperties = { color: 'rgb(91,86,112)', fontSize: 15, lineHeight: 1.65, margin: '0 0 12px' };
const link: CSSProperties = { color: 'rgb(93,84,145)', fontWeight: 600, textDecoration: 'none' };
const li: CSSProperties = { color: 'rgb(91,86,112)', fontSize: 15, lineHeight: 1.7 };

export default async function EliminarCuenta() {
  const { data: contacto } = await createClient()
    .from('club_settings')
    .select('whatsapp, email')
    .eq('id', 1)
    .single();
  const email = contacto?.email ?? data.clubSettings.email;
  const whatsapp = contacto?.whatsapp ?? data.clubSettings.whatsapp;

  const paso = (n: number, titulo: string, cuerpo: ReactNode) => (
    <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, background: 'rgb(93,84,145)', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{n}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'rgb(33,30,51)', marginBottom: 2 }}>{titulo}</div>
        <div style={{ color: 'rgb(91,86,112)', fontSize: 14.5, lineHeight: 1.6 }}>{cuerpo}</div>
      </div>
    </div>
  );

  return (
    <main style={{ minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(245,244,248,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgb(230,227,240)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href={urls.landing} style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26, color: 'rgb(93,84,145)', textDecoration: 'none' }}>Kumo</a>
          <a href={urls.landing} style={{ fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, color: 'rgb(135,129,160)', textDecoration: 'none' }}>← Volver</a>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Eliminar tu cuenta</h1>
        <p style={{ ...p, fontSize: 16, marginBottom: 36 }}>Podés borrar tu cuenta de Kumo y todos tus datos cuando quieras, vos mismo, sin pedírselo a nadie.</p>

        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>Desde la app o desde la web</h2>
          {paso(1, 'Entrá a tu cuenta', <>En la app de Kumo, o en <a href={urls.webapp} style={link}>kumo.pet/app</a>.</>)}
          {paso(2, 'Andá a Mi perfil', 'En la web está en el menú lateral. En la app, dentro de "Más".')}
          {paso(3, 'Tocá "Eliminar mi cuenta"', 'Está abajo de todo, después de "Darme de baja".')}
          {/* El paso 4 dice las dos formas porque son distintas de verdad: en la
              web se escribe la palabra, y en la app son dos confirmaciones
              (Alert.prompt no existe en Android). Describir solo una manda a la
              mitad de la gente a buscar un campo que no va a encontrar. */}
          {paso(4, 'Confirmá', <>Te mostramos antes exactamente qué se va a borrar. En la web te pedimos escribir <strong>BORRAR</strong>; en la app, confirmar dos veces. El borrado es inmediato y no se puede deshacer.</>)}
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>Qué se borra</h2>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            <li style={li}>Tu perfil y tus datos personales</li>
            <li style={li}>Tus mascotas, sus vacunas y sus fotos</li>
            <li style={li}>Tus reintegros y los comprobantes que subiste</li>
            <li style={li}>Tus publicaciones y respuestas del foro</li>
            <li style={li}>Tu negocio, si diste uno de alta</li>
            <li style={li}>Tu usuario de acceso</li>
          </ul>
          {/* Se dice explícito porque es la duda que frena a cualquiera antes de
              tocar el botón: si borrar la cuenta lo deja pagando para siempre. */}
          <p style={p}>Si tenías débito automático, <strong>se cancela en el mismo paso</strong>: Mercado Pago no te vuelve a cobrar. Si el cobro no se puede cancelar, no borramos nada y te avisamos, para que no quede una cuenta borrada con un débito vivo.</p>
          <p style={p}>El borrado es definitivo: no guardamos una copia para restaurarla después.</p>
        </section>

        {/* Esta sección responde el punto OPCIONAL del formulario de Play sobre
            borrado parcial. Se declara que sí porque es verdad —el socio borra
            estas cosas él mismo desde cualquiera de las dos superficies— pero
            declararlo obliga a documentarlo en esta misma URL. */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>Borrar solo una parte, sin cerrar la cuenta</h2>
          <p style={p}>No hace falta eliminar la cuenta para borrar cosas. Desde la app o desde la web, en la sección donde está cada una, podés borrar vos mismo:</p>
          <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
            <li style={li}>Una mascota, con sus vacunas y su foto</li>
            <li style={li}>Un contacto de emergencia</li>
            <li style={li}>Una publicación o una respuesta del foro</li>
            <li style={li}>Una reseña que hayas dejado</li>
            <li style={li}>Los prestadores que guardaste</li>
            <li style={li}>Tu negocio, si diste uno de alta</li>
          </ul>
          <p style={p}>Tus datos personales —teléfono, domicilio, cuenta bancaria— se editan o se vacían desde <strong>Mi perfil</strong>. Y los avisos push se apagan desde el interruptor de Notificaciones en la app, que borra el registro de tu teléfono.</p>
          {/* Se dice qué NO puede borrar solo, porque prometer de más acá es peor
              que no prometer: los reintegros y los cobros son el registro de una
              operación entre dos partes, no contenido del socio. */}
          <p style={p}>Los reintegros y los cobros no se borran por separado: son el registro de una operación entre vos y el club. Si necesitás que se borre alguno en particular, escribinos a <a href={`mailto:${email}`} style={link}>{email}</a> y lo vemos.</p>
        </section>

        {/* Google exige que esta página diga qué se CONSERVA y por cuánto tiempo,
            no solo qué se borra. Sin esta sección el formulario del Play Console
            se puede rechazar aunque la URL exista y funcione. */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>Qué se conserva</h2>
          <p style={p}>Kumo no conserva nada. No hay período de retención ni copias de respaldo del contenido borrado: el borrado corre en una sola operación sobre la base de datos y sobre los archivos, y no guardamos una versión previa para restaurar.</p>
          <p style={p}>Lo único que queda fuera de nuestro alcance son los registros que <strong>Mercado Pago</strong> mantiene por su cuenta sobre los pagos que procesó, porque está obligado a conservarlos como procesador de pagos. Esos registros son de Mercado Pago, no de Kumo, y podés consultarlos o reclamarlos directamente ante ellos.</p>
        </section>

        <section style={{ marginBottom: 40 }}>
          <h2 style={h2}>Si no podés entrar a tu cuenta</h2>
          <p style={p}>Escribinos a <a href={`mailto:${email}`} style={link}>{email}</a> o por WhatsApp al <a href={waLink(whatsapp)} target="_blank" rel="noopener noreferrer" style={link}>{whatsapp}</a> desde el mail o el teléfono con el que te registraste, y lo hacemos por vos. Te confirmamos cuando esté hecho.</p>
        </section>

        <p style={{ fontSize: 12.5, color: 'rgb(162,157,186)' }}>
          Podés ver también nuestra <a href="/legal#privacidad" style={link}>política de privacidad</a>. El derecho a pedir la supresión de tus datos personales está protegido por la Ley 25.326.
        </p>
      </div>
    </main>
  );
}
