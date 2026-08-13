-- El número de socio es de los socios.
--
-- `member_no` era un `serial`: un contador que corría para CUALQUIER perfil. Con
-- eso, un admin quedaba como "socio #60" —que no significa nada, un admin no es
-- socio— y cada usuario de prueba que se creaba y borraba se llevaba un número
-- puesto, dejando huecos en el padrón.
--
-- Ahora el número:
--   · se asigna solo cuando el perfil es de un socio,
--   · se asigna una vez y no se toca más, ni al cambiar de rol: si alguien fue
--     socio, ese número lo identifica para siempre (puede estar en un carnet).
--
-- Los huecos que ya existen quedan: renumerar significaría cambiarle el número a
-- un socio que ya lo vio, y un número de socio que cambia no es un número de socio.
--
-- Todo va calificado con `public.`: la primera corrida falló con "column
-- member_no of relation profiles does not exist" porque el editor resolvió otra
-- tabla `profiles` (search_path). Con el esquema explícito no hay ambigüedad.

-- 1 · El número deja de asignarse solo a todo el mundo.
alter table public.profiles alter column member_no drop not null;
alter table public.profiles alter column member_no drop default;

-- La secuencia se conserva: es la que sigue dando los números. Al soltar el
-- default deja de pertenecer a la columna, así que se la desvincula a mano para
-- que un futuro `drop column` no se la lleve puesta.
alter sequence public.profiles_member_no_seq owned by none;

-- Dos socios no pueden compartir número. Los nulos no compiten entre sí en
-- Postgres, así que los perfiles sin número no molestan.
alter table public.profiles add constraint profiles_member_no_unico unique (member_no);

-- 2 · Quien no es socio no tiene número.
-- El guard de columnas congela `member_no` (compara old con new) y también se
-- dispara con este update, porque en el editor de SQL no hay `auth.uid()` y por
-- lo tanto `is_admin()` da false. Se lo apaga solo para esta corrección.
alter table public.profiles disable trigger profiles_campos_guard;
update public.profiles set member_no = null where role <> 'socio';
alter table public.profiles enable trigger profiles_campos_guard;

-- 3 · La asignación.
create or replace function public.profiles_numero_de_socio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'socio' and new.member_no is null then
    new.member_no := nextval('public.profiles_member_no_seq');
  end if;
  return new;
end $$;

-- OJO CON EL NOMBRE: con varios triggers BEFORE del mismo tipo, Postgres los
-- corre en orden alfabético. Este tiene que ir DESPUÉS de
-- `profiles_campos_guard`, que para quien no es admin hace
-- `new.member_no := old.member_no`: si corriera antes, el guard borraría el
-- número recién asignado y el socio se quedaría sin número para siempre.
-- 'profiles_campos_guard' < 'profiles_numero_de_socio' porque 'c' < 'n'.
drop trigger if exists profiles_numero_de_socio on public.profiles;
create trigger profiles_numero_de_socio before insert or update on public.profiles
  for each row execute function public.profiles_numero_de_socio();

comment on column public.profiles.member_no is
  'Número de socio. Null si el perfil no es de un socio (admin, prestador). Lo asigna el trigger profiles_numero_de_socio una sola vez y no cambia nunca.';
