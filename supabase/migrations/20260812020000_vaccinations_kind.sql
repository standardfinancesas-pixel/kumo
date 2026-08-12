-- El carnet del prototipo distingue tres cosas: vacunas, estudios y
-- antiparasitarios. En la tabla no había dónde guardarlo, así que el selector
-- "Tipo" del formulario no se podía persistir y el ícono se adivinaba del
-- nombre con una regex. Con esta columna el tipo es un dato, no una heurística.

alter table vaccinations
  add column if not exists kind text not null default 'Vacuna';

alter table vaccinations
  drop constraint if exists vaccinations_kind_check;

alter table vaccinations
  add constraint vaccinations_kind_check
  check (kind in ('Vacuna', 'Estudio', 'Antiparasitario'));

-- Lo ya cargado son vacunas, salvo lo que por el nombre es claramente otra cosa.
update vaccinations set kind = 'Antiparasitario'
  where kind = 'Vacuna' and (name ilike '%desparasit%' or name ilike '%antiparasit%' or name ilike '%pipeta%');
update vaccinations set kind = 'Estudio'
  where kind = 'Vacuna' and (name ilike '%análisis%' or name ilike '%analisis%' or name ilike '%ecograf%' or name ilike '%radiograf%' or name ilike '%estudio%');
