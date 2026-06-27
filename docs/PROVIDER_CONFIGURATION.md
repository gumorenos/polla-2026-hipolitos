# Configuración segura de proveedores

Las API keys de proveedores no se guardan en GitHub. En producción viven en la base de datos SQLite del Raspberry Pi cifradas, o en variables de entorno como respaldo.

## Requisitos

Configurar `API_KEYS_ENCRYPTION_SECRET` con un secreto aleatorio de al menos 32 caracteres. Debe existir únicamente en el entorno del servidor y no se debe reutilizar una API key como secreto de cifrado.

Sin esta variable, `/admin/odds` muestra una advertencia y bloquea el guardado de nuevas claves. Las claves existentes en variables de entorno continúan disponibles.

## Resolución de credenciales

El servidor resuelve cada proveedor en este orden:

1. Credencial activa y cifrada en `ProviderCredential`.
2. Variable de entorno existente y habilitada.
3. Proveedor no configurado.

Las variables actuales se mantienen: `THE_ODDS_API_KEY`, `ODDS_API_IO_KEY`, `FOOTBALL_DATA_API_KEY` y `API_FOOTBALL_KEY`, junto con sus interruptores `*_ENABLED`.

## Administración

Solo un superadministrador puede abrir `/admin/odds` y ejecutar acciones de credenciales. El panel permite configurar o reemplazar una clave, probar la conexión, desactivar la credencial almacenada y eliminarla. La clave descifrada nunca se envía al navegador ni se registra en logs.

`Probar conexión` hace una única solicitud manual al proveedor. La carga normal de la página no consulta APIs externas.

## Cuotas y límites

- The Odds API: `x-requests-remaining`, `x-requests-used`, `x-requests-last`.
- Football-Data: `X-RequestsAvailable`, `X-RequestCounter-Reset`.
- API-Football: cabeceras `x-ratelimit-*` cuando el proveedor las devuelve.
- Odds-API.io: estado HTTP; las cuotas se muestran como no disponibles si no hay cabeceras compatibles.

No se calculan ni inventan tiempos de reinicio ausentes.

## Producción y repositorio

La base de producción permanece en `/var/lib/la-polla-2026/prod.db`. `.env`, `.env.local`, variantes `.env.*`, bases SQLite y `app/package-lock.json` están ignorados. Los archivos `.env.example` solo contienen marcadores de posición.

## Rollback

1. Mantener o restaurar la variable de entorno del proveedor y su `*_ENABLED=true`.
2. Desactivar o eliminar la credencial almacenada desde `/admin/odds`.
3. Confirmar el origen `Variable de entorno` y probar la conexión.
4. No eliminar ni editar migraciones aplicadas; una reversión de código debe conservar la tabla adicional hasta una migración posterior explícita.
