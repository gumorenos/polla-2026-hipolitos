# Importación de Cuotas de Campeón (Champion Odds)

Esta guía explica el flujo de importación de cuotas de campeón ("Outrights") utilizando **The Odds API**.

## Arquitectura

1. **Client API (`app/src/lib/odds/the-odds-api.ts`)**:
   - `listTheOddsApiOutrightSports()`: Se comunica con `/v4/sports` para encontrar qué deportes tienen mercados de ganador final (outrights).
   - `fetchChampionOutrights()`: Obtiene todas las cuotas de un deporte específico para el mercado `outrights` y normaliza la salida.
   
2. **Server Actions (`app/src/lib/actions/champion-odds.ts`)**:
   - `adminDetectChampionMarkets()`: Expone la detección de deportes y filtra posibles candidatos basados en palabras clave como "world cup", "fifa", "soccer".
   - `adminImportChampionOdds()`: Procesa la importación calculando la mediana de todas las bookmakers por equipo, y actualizando el `ChampionOddsSnapshot` para todas las ligas de tipo `champion_survivor`.

3. **Admin UI (`/admin/odds`)**:
   - La sección **Cuotas de Campeón (Outrights)** permite al administrador:
     - Detectar candidatos en vivo.
     - Importar las cuotas de un `sportKey` seleccionado.

## Manejo de Aliases de Equipos

Cuando se importa una cuota, el nombre raw de The Odds API (ej. "Bosnia-Herzegovina") se pasa por el flujo de **TeamAlias**:
- **Si existe el alias**: La cuota se asocia inmediatamente a nuestro código interno de equipo.
- **Si NO existe**: La cuota entra como `unmatched` y se guarda en la tabla `provider_team_outcome`.
  - El administrador puede ir a la sección "Mapeo de Outcomes de Proveedores" para emparejarlo, y volver a intentar la importación de cuotas.

## Modelo de Datos

- **`ChampionOddsSnapshot`**: Almacena las cuotas de campeón importadas por liga, o globalmente dependiendo de la implementación de Champion Survivor. La importación actualiza todas las ligas `champion_survivor` activas usando `median_aggregated` para el valor de `bookmaker`.

## Consideraciones

- The Odds API cobra las peticiones de Outrights igual que un mercado estándar.
- Dado que las cuotas de campeón cambian lentamente, se recomienda importar sólo una o dos veces por día para reducir el consumo de la cuota.
- Al igual que las cuotas de partidos, las llamadas fallidas por cuota (HTTP 429) actualizarán la tabla `ProviderStatus` para prevenir bloqueos y penalizaciones.
