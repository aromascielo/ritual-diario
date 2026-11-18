# Plan de construcción — Ritual Diario v2

Una fase por vez. Al terminar cada fase: probar, marcarla como hecha acá y anotar lo pendiente.

| Fase | Qué incluye | Quién prueba | Estado |
|---|---|---|---|
| 0. Base | Especificación v2, carpeta, proyecto Supabase `ritual-diario` (San Pablo), repositorio GitHub privado | Cami revisa la spec | ✅ (código subido a GitHub el 18 nov 2026) |
| 1. Base de datos | Tablas v2, permisos (admin / líder / miembro), funciones de cálculo (cumplimiento al día, avance, VEA), generador de tareas, pruebas de permisos | Claude (pruebas automáticas) | ✅ 18 nov 2026 |
| 2. App: lo diario | Login con código, Hoy, detalle de tarea (hecha / omitir con motivo / comentarios), agregar tarea con fecha | Cami en el celular (URL de prueba) | 🧪 Hecha, falta que Cami la pruebe (18 nov 2026) |
| 3. Gestión | Tareas (crear, editar, archivar; recurrentes para líderes), Áreas y Personas desde Configuración | Cami + Laura | ⬜ |
| 4. Objetivos y VEA | Objetivos de todos los tipos, aportes, Plan VEA, carga de ventas | Cami + Laura (ventas) | ⬜ |
| 5. Seguimiento y avisos | Áreas y Equipo con % al día, push (previo, vencida, resumen, comentarios), campana de alertas | Cami (Android); iPhone con Candela | ⬜ |
| 6. Publicación y cambio | Cloudflare con GitHub, limpiar datos de prueba, cargar equipo y tareas reales, pasar a Laura, apagar Netlify | Todo el equipo | ⬜ |
| 7. Sumar a Candela | Alta como líder de Redes, Campañas y Publicidad, tareas, prueba en iPhone | Candela | ⬜ (ene 2027) |

## Pendientes de Cami
- [x] Crear el repositorio privado `ritual-diario` en GitHub.
- [x] Responder las preguntas abiertas.
- [x] Darle a Claude permiso para subir al repositorio (app de Claude instalada en GitHub).
- [x] Pegar el texto de `docs/instrucciones-proyecto.md` en las instrucciones del Proyecto de claude.ai.
- [ ] Fase 2: cambiar las plantillas de mail de Supabase para que manden el código (README.md, paso 1).
- [ ] Fase 2: conectar Cloudflare con GitHub y pasarle a Claude la dirección `*.workers.dev` (README.md, paso 2).
- [ ] Fase 2: probar en el celular y contarle a Claude qué anduvo y qué cambiar (README.md, paso 3).

## Estado de la base de datos (proyecto `ritual-diario`, `oehrvzijfktxcoyfommj`)
- 6 migraciones aplicadas (`supabase/migrations/`). Cargadas: 8 áreas y el Plan VEA con sus 4 metas.
- Personas: Cami invitada como admin (con "carga ventas"); su perfil se crea en el primer ingreso.
  Después del primer ingreso, sumarla a sus áreas (como admin ya puede crear tareas en todas).
- Cron activo: `generar-instancias` (00:05 hora Argentina). El cron de notificaciones se agrega en la fase 5.
- Pruebas: `supabase/tests/permisos.sql` → 24/24 OK. Cálculo VEA verificado con ventas de ejemplo.

## Registro
- 18 nov 2026 — Revisión de la v1 y decisiones de rumbo. Creado el proyecto Supabase `ritual-diario` (sa-east-1). Spec v2 escrita.
- 18 nov 2026 — Fase 1 terminada: base de datos v2 aplicada y probada.
- 18 nov 2026 — Primer envío del código al repositorio `aromascielo/ritual-diario` (rama `main`).
- 18 nov 2026 — Fase 2 programada en `web/` (Vite + React + TypeScript): login con código, Hoy (vencidas, tareas por área,
  ver todo el equipo, % al día de la semana), detalle (hecha / omitir con motivo / volver a pendiente, comentarios),
  agregar tarea única con fecha y horario, vista inicial de Objetivos (avance_objetivos), Configuración (nombre,
  apariencia, cerrar sesión). Probada en navegador con datos simulados y las llamadas probadas contra la base
  (se deshace sola): 8/8 OK. Decisión: login con `shouldCreateUser: true` (ver CLAUDE.md §8).
