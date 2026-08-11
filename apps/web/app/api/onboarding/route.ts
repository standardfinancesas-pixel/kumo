import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase-service';

/**
 * Alta real de socio. Corre en el servidor con la service-role key:
 * crea el usuario de auth ya confirmado (sin depender del mail de
 * verificación) e inserta su perfil y mascota. El cliente hace login
 * normal después con el mismo email/contraseña.
 */

type Body = {
  socio: { nombre: string; dni: string; fnac: string; domicilio: string; localidad: string; provincia: string; tel: string; email: string; password: string };
  pet: { nombre: string; especie: string; sexo: string; castrado: string; raza: string; edad: string; peso: string; microchip: string; vet: string; foto: string };
  plan: string;
};

const PET_TYPE: Record<string, string> = { Perro: 'perro', Gato: 'gato', Otro: 'otro' };
const PET_SEX: Record<string, string> = { Macho: 'macho', Hembra: 'hembra' };

function fnacToIso(fnac: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fnac.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}
function leadingNumber(s: string): number | null {
  const m = /(\d+([.,]\d+)?)/.exec(s ?? '');
  return m?.[1] ? Number(m[1].replace(',', '.')) : null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const { socio, pet, plan } = JSON.parse(form.get('payload') as string) as Body;
  const photoFile = form.get('photo');

  if (!socio?.email || !socio?.password || socio.password.length < 6 || !socio?.nombre || !pet?.nombre || !plan) {
    return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
  }

  const db = getServiceClient();

  let uploadedPhotoUrl: string | null = null;
  if (photoFile instanceof File && photoFile.size > 0) {
    const ext = photoFile.name.split('.').pop() || 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await db.storage.from('pet-photos').upload(path, await photoFile.arrayBuffer(), { contentType: photoFile.type || 'image/jpeg' });
    if (!uploadErr) {
      uploadedPhotoUrl = db.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
    } else {
      console.error('[onboarding] photo upload failed', uploadErr);
    }
  }

  const { data: planRow, error: planErr } = await db.from('plans').select('id').eq('name', plan).single();
  if (planErr || !planRow) {
    console.error('[onboarding] plan lookup failed', { plan, planErr });
    return NextResponse.json({ error: 'Plan inválido.' }, { status: 400 });
  }

  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: socio.email,
    password: socio.password,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    const msg = /already registered|already exists/i.test(createErr?.message ?? '') ? 'Ya existe una cuenta con ese email.' : (createErr?.message ?? 'No se pudo crear la cuenta.');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const userId = created.user.id;

  const address = [socio.domicilio, socio.localidad, socio.provincia].filter(Boolean).join(', ');
  const { data: profileRow, error: profileErr } = await db
    .from('profiles')
    .insert({
      id: userId,
      full_name: socio.nombre,
      email: socio.email,
      phone: socio.tel || null,
      address: address || null,
      dni: socio.dni || null,
      birth_date: fnacToIso(socio.fnac),
      plan_id: planRow.id,
    })
    .select('member_no')
    .single();

  if (profileErr || !profileRow) {
    await db.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'No se pudo crear el perfil del socio.' }, { status: 500 });
  }

  const { error: petErr } = await db.from('pets').insert({
    owner_id: userId,
    name: pet.nombre,
    type: PET_TYPE[pet.especie] ?? 'otro',
    breed: pet.raza || null,
    age_years: leadingNumber(pet.edad),
    weight_kg: leadingNumber(pet.peso),
    microchip: pet.microchip || null,
    neutered: pet.castrado === 'Sí',
    sex: PET_SEX[pet.sexo] ?? null,
    vet_name: pet.vet || null,
    photo_url: uploadedPhotoUrl ?? (pet.foto?.startsWith('/img/') ? pet.foto : null),
  });

  if (petErr) {
    await db.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: 'No se pudo crear la mascota.' }, { status: 500 });
  }

  return NextResponse.json({ memberNo: profileRow.member_no });
}
