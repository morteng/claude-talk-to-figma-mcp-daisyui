# Problema y Solución: Error "Must join a channel before sending commands"

## Problema Identificado

Durante las pruebas de las herramientas refactorizadas, se ha identificado un problema crítico:

- La herramienta `join_channel` funciona correctamente y permite unirse a un canal de Figma
- Sin embargo, todas las herramientas subsiguientes fallan con el error: **"Error getting document info: Must join a channel before sending commands"**

### Análisis del Problema

Después de revisar el código, hemos identificado la causa raíz:

1. En el archivo `utils/websocket.ts`, la función `sendCommandToFigma` verifica que exista un canal actual antes de enviar comandos:
   ```typescript
   const requiresChannel = command !== "join";
   if (requiresChannel && !currentChannel) {
     reject(new Error("Must join a channel before sending commands"));
     return;
   }
   ```

2. En la implementación de la herramienta `join_channel` en `document-tools.ts`, se estaba usando el comando "join" correctamente:
   ```typescript
   await sendCommandToFigma("join", { channel: channel });
   ```

3. Sin embargo, existía una inconsistencia entre cómo se maneja el comando "join" y cómo se actualiza la variable `currentChannel`:

   - La función `joinChannel` en `websocket.ts` establece `currentChannel = channelName` después de una unión exitosa
   - Pero la herramienta `join_channel` llamaba directamente a `sendCommandToFigma("join", ...)` en lugar de usar la función `joinChannel`
   - Como resultado, aunque el comando "join" se ejecutaba correctamente, la variable `currentChannel` no se actualizaba

## Solución Implementada

La solución implicó una modificación en la herramienta `join_channel` para asegurar que se actualice correctamente la variable `currentChannel`:

```typescript
// Join Channel Tool - Versión corregida
server.tool(
  "join_channel",
  "Join a specific channel to communicate with Figma",
  {
    channel: z.string().describe("The name of the channel to join").default(""),
  },
  async ({ channel }) => {
    try {
      if (!channel) {
        // If no channel provided, ask the user for input
        return {
          content: [
            {
              type: "text",
              text: "Please provide a channel name to join:",
            },
          ],
          followUp: {
            tool: "join_channel",
            description: "Join the specified channel",
          },
        };
      }

      // Reemplazar la llamada directa a sendCommandToFigma con joinChannel
      // para asegurar que currentChannel se actualice correctamente
      await joinChannel(channel);
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully joined channel: ${channel}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);
```

### Cambios Clave Implementados:

1. Se reemplazó `await sendCommandToFigma("join", { channel: channel });` con `await joinChannel(channel);`
2. La función `joinChannel` maneja internamente:
   - Enviar el comando "join" a Figma
   - Actualizar la variable `currentChannel`
   - Manejar errores apropiadamente

### Detalles de la Implementación

Para implementar esta solución:

1. Se modificó el archivo `src/talk_to_figma_mcp/tools/document-tools.ts`
2. Se añadió la importación de la función `joinChannel` desde `../utils/websocket.js`:
   ```typescript
   import { sendCommandToFigma, joinChannel } from "../utils/websocket.js";
   ```
3. Se reemplazó la implementación anterior de la herramienta `join_channel` con la versión corregida

4. También se corrigió un problema adicional relacionado con las extensiones de archivo en las importaciones:
   - Se agregó la extensión `.js` a todas las importaciones relativas para cumplir con los requisitos del sistema de módulos TypeScript configurado como "node16" o "nodenext".

## Impacto del Cambio

Este cambio garantiza que:
- La variable `currentChannel` se actualiza correctamente después de unirse a un canal
- Todas las herramientas subsiguientes pueden enviar comandos a Figma correctamente
- Se mantiene la consistencia en cómo se manejan los canales en todo el código

## Estado de Validación

- [x] Cambio implementado
- [x] Pruebas realizadas
- [x] Funcionalidad verificada

## Lecciones Aprendidas

Este problema resalta la importancia de:

1. **Encapsulamiento adecuado**: El estado del canal debería estar completamente encapsulado en el módulo websocket.
2. **Consistencia en la implementación**: Usar siempre las funciones de alto nivel que manejan tanto la comunicación como el estado.
3. **Separación de responsabilidades**: La herramienta debe usar los métodos de utilidad proporcionados para tareas específicas.

El enfoque de modularización adoptado en la refactorización ha facilitado la identificación y solución de este problema al hacer más explícitas las dependencias entre módulos.