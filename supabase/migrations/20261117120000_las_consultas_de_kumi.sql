-- KUMI · el registro de cada consulta de triaje.
--
-- Qué se guarda y qué no, que es la decisión importante de esta tabla:
--
-- * SÍ se guarda el veredicto con sus motivos y las REGLAS que lo produjeron.
--   Sin eso no hay forma de auditar un triaje después, ni de medir qué reglas se
--   disparan de verdad cuando un veterinario las revise.
-- * SÍ se guarda qué versión del deslinde aceptó la persona y cuándo. El día que
--   haya un reclamo, lo que importa es poder mostrar el texto exacto que aceptó
--   ese día, no el que esté publicado entonces.
-- * NO se guardan las fotos. Viajan en el pedido, las mira el modelo y se
--   descartan. El propio deslinde dice que los datos se usan solo para esta
--   orientación (Ley 25.326), y una foto de la panza de un perro puede tener
--   adentro una cara, una casa o un documento. Lo que no se guarda no se filtra.
--   Queda constancia de CUÁNTAS mandó, que es lo que hace falta para entender la
--   consulta.

create table if not exists triage_consultas (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id) on delete cascade,
  -- Opcional: la consulta puede ser por una mascota que no está cargada.
  pet_id uuid references pets(id) on delete set null,

  especie text not null,
  edad_meses int,
  peso_kg numeric(5,2),
  horas_evolucion int,

  -- Lo que se juntó en la conversación.
  senales text[] not null default '{}',
  toxicos text[] not null default '{}',
  sintomas text[] not null default '{}',
  relato text,
  fotos int not null default 0,

  -- El veredicto. `reglas` es lo que lo decidió, en claves cortas y estables.
  nivel text not null check (nivel in ('guardia', 'videoconsulta', 'casa')),
  motivos text[] not null default '{}',
  reglas text[] not null default '{}',

  -- La conversación, solo texto. Sirve para entender por qué el triaje concluyó
  -- lo que concluyó; las imágenes no entran acá por lo dicho arriba.
  mensajes jsonb not null default '[]'::jsonb,

  deslinde_version text not null,
  consentimiento_en timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists triage_consultas_socio_idx on triage_consultas (member_id, created_at desc);
-- Para que el club pueda mirar las urgencias sin leer toda la tabla.
create index if not exists triage_consultas_nivel_idx on triage_consultas (nivel, created_at desc);

alter table triage_consultas enable row level security;

-- El socio ve y crea las suyas. El admin ve todo: es quien tiene que poder
-- revisar un triaje que salió mal, y quien va a medir las reglas con un
-- veterinario. Nadie edita ni borra: un registro de triaje que se puede
-- cambiar después no sirve como registro.
create policy "triaje propio - select" on triage_consultas for select
  using (member_id = auth.uid() or is_admin());
create policy "triaje propio - insert" on triage_consultas for insert
  with check (member_id = auth.uid());

comment on table triage_consultas is
  'Consultas de KUMI. Las fotos NO se guardan (solo cuántas fueron): viajan en el pedido y se descartan.';
comment on column triage_consultas.reglas is
  'Qué reglas de packages/shared/src/triaje.ts decidieron el nivel. Es lo que hace auditable el triaje.';
comment on column triage_consultas.deslinde_version is
  'Versión del deslinde que aceptó la persona. Si el texto cambia, las consultas viejas siguen apuntando al que firmaron.';
