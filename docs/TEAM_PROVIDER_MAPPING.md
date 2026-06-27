# Mapeo de equipos por proveedor

Los proveedores no siempre identifican una selección con el mismo nombre que `Team.code` o `Team.name`. El sistema usa `TeamAlias` para vincular un nombre externo con un equipo local sin modificar la respuesta original del proveedor.

## Ejemplo BIH

Los nombres `Bosnia and Herzegovina`, `Bosnia & Herzegovina`, `Bosnia-Herzegovina` y `Bosnia Herzegovina` se normalizan como `bosnia herzegovina`. `Bosnia` se conserva como un alias explícito adicional de `BIH`.

La normalización aplica minúsculas, elimina espacios externos, diacríticos, puntos y apóstrofes, unifica guiones y ampersands, y colapsa espacios repetidos.

## Resolución

El orden de resolución es:

1. Alias exacto o normalizado para el proveedor.
2. Alias global (`provider = '*'`).
3. Código local exacto.
4. Nombre local normalizado.

Las coincidencias difusas no crean vínculos ni se usan para escrituras de aliases. Un resultado ambiguo queda pendiente para revisión administrativa.

## Diagnóstico administrativo

`/admin/odds` muestra `Mapeo de equipos por proveedor`. La sección incluye el nombre recibido, nombre normalizado, proveedor, contexto, equipo sugerido, confianza y estado.

Acciones disponibles para superadministradores:

- `Crear aliases sugeridos`: inserta de forma idempotente los aliases base únicamente para códigos presentes en `Team`.
- `Vincular / crear alias`: crea un alias específico del proveedor y marca la observación como resuelta.
- `Ignorar`: conserva la observación sin volver a sugerirla automáticamente.

La carga de la página no consulta proveedores externos. Las observaciones se recopilan únicamente durante solicitudes de cuotas, H2H o resultados ya iniciadas por los flujos existentes.

## Integraciones

- Cuotas de partidos: los aliases globales y específicos del proveedor participan en el mapeo de eventos y outcomes.
- Resultados/fixtures: Football-Data y API-Football registran nombres observados y usan resolución exacta como respaldo de sus códigos o IDs.
- Cuotas de campeón: `resolveProviderTeamAlias` queda disponible para un importador futuro, pero este cambio no implementa importación de cuotas de campeón.

Los aliases base cubren BIH, USA, KOR, IRI/IRN, CIV y TUR. En este repositorio Irán usa el código local `IRI`.
