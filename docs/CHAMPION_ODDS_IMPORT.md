# Importación de Cuotas de Campeón (Champion Odds)

Esta guía explica el flujo de importación de cuotas de campeón ("Outrights") utilizando **The Odds API**.

## Arquitectura

1. **Client API (`app/src/lib/odds/the-odds-api.ts`)**:
   - `listTheOddsApiOutrightSports()`: Se comunica con `/v4/sports` para encontrar qué deportes tienen mercados de ganador final (outrights).
   - `fetchChampionOutrights()`: Obtiene todas las cuotas de un sport key FIFA World Cup validado para el mercado `outrights` y normaliza la salida.
   
2. **Server Actions (`app/src/lib/actions/champion-odds.ts`)**:
   - `adminDetectChampionMarkets()`: Separa los candidatos recomendados de Soccer/FIFA World Cup del resto de mercados outright.
   - `adminPreviewChampionOdds()`: Muestra una muestra de outcomes sin escribir aliases, diagnósticos ni snapshots.
   - `adminImportChampionOdds()`: Procesa la importación calculando la mediana de todas las bookmakers por equipo, y actualizando el `ChampionOddsSnapshot` para todas las ligas de tipo `champion_survivor`.

3. **Admin UI (`/admin/odds`)**:
   - La sección **Cuotas de Campeón (Outrights)** permite al administrador:
     - Detectar candidatos en vivo.
     - Revisar grupo, título, descripción y soporte de outrights.
     - Previsualizar una muestra de selecciones antes de guardar.
     - Importar las cuotas de un `sportKey` FIFA World Cup validado.

## Guardrails del Sport Key

La primera importación operativa seleccionó accidentalmente un mercado outright ajeno al Mundial y produjo nombres universitarios de Estados Unidos como diagnósticos `unmatched`. El importador ahora bloquea el flujo antes de llamar al endpoint de cuotas o escribir datos cuando el sport key no cumple todos estos criterios:

- Tiene `has_outrights=true`.
- Está identificado como `soccer_*`.
- Contiene señales de FIFA World Cup.
- No corresponde a clasificatorias, Mundial de Clubes, torneos juveniles o femeninos.
- No contiene señales de NCAA, NFL, NBA, NCAAB, MLB, NHL u otros deportes.

No seleccione sport keys de NCAA, NFL, NBA, college u otras ligas aunque indiquen `winner`, `champion` u `outright`. Esos términos por sí solos no convierten un mercado en cuotas de campeón del Mundial.

Antes de importar, confirme que la muestra contiene selecciones nacionales esperadas. La previsualización no persiste `ChampionOddsSnapshot`, `provider_team_outcome` ni `team_alias`; únicamente puede actualizar el estado operativo y la cuota disponible del proveedor.

## Manejo de Aliases de Equipos

Cuando se importa una cuota, el nombre raw de The Odds API (ej. "Bosnia-Herzegovina") se pasa por el flujo de **TeamAlias**:
- **Si existe un alias para `the-odds-api`**: Se aplica con prioridad.
- **Si existe un alias global con `provider='*'`**: Se aplica sin exigir un alias duplicado para The Odds API. Por ejemplo, `Bosnia Herzegovina` puede resolver a `BIH` mediante el alias global existente.
- **Si NO existe**: La cuota entra como `unmatched` y se guarda en la tabla `provider_team_outcome`.
  - El administrador puede ir a la sección "Mapeo de Equipos por Proveedor" para emparejarlo.
  - La asignación crea o actualiza `team_alias` y marca el `provider_team_outcome` como `matched`.
  - Después debe volver a ejecutar la importación para crear el snapshot correspondiente.

## Modelo de Datos

- **`ChampionOddsSnapshot`**: Almacena las cuotas de campeón importadas por liga, o globalmente dependiendo de la implementación de Champion Survivor. La importación actualiza todas las ligas `champion_survivor` activas usando `median_aggregated` para el valor de `bookmaker`.

## Consideraciones

- The Odds API cobra las peticiones de Outrights igual que un mercado estándar.
- Dado que las cuotas de campeón cambian lentamente, se recomienda importar sólo una o dos veces por día para reducir el consumo de la cuota.
- Al igual que las cuotas de partidos, las llamadas fallidas por cuota (HTTP 429) actualizarán la tabla `ProviderStatus` para prevenir bloqueos y penalizaciones.
- El identificador canónico del proveedor en credenciales, aliases, diagnósticos e importación es `the-odds-api`.
- Si una importación errónea dejó únicamente diagnósticos claramente ajenos al fútbol, se pueden eliminar de producción las filas `provider='the-odds-api'`, `marketType='outrights'`, `status='unmatched'` después de crear un backup. Esta limpieza no debe borrar aliases ni `ChampionOddsSnapshot` válidos.

## Clarificaciones Adicionales sobre Roster y Diagnósticos

1. **Tabla Master `team` vs Roster del Torneo**:
   - La tabla `team` actúa como un catálogo maestro de selecciones nacionales y puede contener más de 48 filas (por ejemplo, 112 filas). No asuma que el conteo de esta tabla representa el torneo activo.
   - El roster oficial del torneo se deriva con prioridad de `TeamTournamentStatus`. Si está vacío, se determina dinámicamente reuniendo los códigos presentes en picks de usuarios, snapshots de cuotas y equipos de partidos reales del fixture, excluyendo marcadores de posición.

2. **Inventario de Aliases Agrupado**:
   - Un mismo código de equipo (por ejemplo, `USA`) puede tener múltiples aliases mapeados de forma global o específica de proveedores (muchos a uno). En la interfaz de administración, estos aliases deben mostrarse agrupados bajo el código de equipo para evitar duplicados visuales confusos.

3. **Diagnósticos Raw Separados de la Cobertura**:
   - Los nombres observados en respuestas raw (`provider_team_outcome`) de todos los proveedores y contextos (como partidos históricos H2H o equipos ajenos como Nigeria) son diagnósticos de soporte y no representan el roster del torneo actual.
   - Estos diagnósticos deben filtrarse y presentarse de manera aislada en un panel de diagnóstico histórico/diagnóstico de nombres observados.

4. **Flujo de Reimportación tras Mapeo**:
   - Cuando un administrador mapea un alias (pasando un nombre observado de `unmatched` a `matched`), las cuotas históricas del snapshot no se recalculan inmediatamente. Es necesario ejecutar una nueva importación de cuotas de campeón desde el panel de control de administración para guardar snapshots de cuotas con los aliases recién mapeados.

