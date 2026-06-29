# Administración de competencias

La interfaz usa **Competencias** como término visible. El modelo Prisma continúa llamándose `League` y la tabla SQLite continúa siendo `league`; este cambio no altera el esquema ni los datos.

## Miembros y participantes

- Una fila de `LeagueMember` representa membresía y permisos.
- Un participante activo requiere `isParticipant = true` y un usuario con estado `approved`.
- Un owner o administrador puede conservar acceso sin competir (`isParticipant = false`).
- Un owner o administrador también puede competir (`isParticipant = true`) sin perder su rol ni permisos.
- El editor muestra `Rol` y `Participa` como controles separados. Al activar participación se crean los standings faltantes; al desactivarla no se borran resultados históricos.
- La competencia siempre debe conservar al menos un owner o administrador.
- Los conteos y el pozo estimado usan participantes aprobados, no el total de miembros.
- `prizePoolOverride` conserva prioridad sobre el cálculo `participantes * entryFee`.

## Rutas y navegación

- `/admin/competencias` es la ruta administrativa principal.
- `/admin/ligas` se mantiene como redirección compatible.
- Un invitado ve únicamente la navegación pública de Inicio y el acceso a `/login`.
- Competencias, Predicciones, Ranking, Perfil y administración requieren una sesión autenticada para aparecer en el menú.

Estas reglas no cambian el modelo de datos. El rol sigue controlando autorización y `isParticipant` controla competencia, picks, ranking y pozo.
