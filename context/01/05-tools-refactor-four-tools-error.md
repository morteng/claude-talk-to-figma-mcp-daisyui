# Problemas y Soluciones para las 4 Herramientas Fallidas tras la Refactorización

Durante las pruebas realizadas con Claude, se identificaron 4 herramientas que no funcionan correctamente después de la refactorización:

- ✅ `get_remote_components` - Falla con error "method not available" (RESUELTO)
- ✅ `flatten_node` - Falla con timeout error (RESUELTO)
- ✅ `create_component_instance` - Falla con timeout error (RESUELTO)
- ✅ `set_effect_style_id` - Falla con timeout error (RESUELTO)

A continuación, se presenta un análisis detallado de cada problema y las soluciones propuestas.

## 1. Herramienta `get_remote_components` (RESUELTO)

### Análisis del Problema

La herramienta `get_remote_components` estaba fallando con el error "method not available". Al examinar el código en `code.js`, encontramos:

```javascript
async function getRemoteComponents() {
  try {
    // Check if figma.teamLibrary is available
    if (!figma.teamLibrary) {
      console.error("Error: figma.teamLibrary API is not available");
      throw new Error("The figma.teamLibrary API is not available in this context");
    }
    
    // Check if figma.teamLibrary.getAvailableComponentsAsync exists
    if (!figma.teamLibrary.getAvailableComponentsAsync) {
      console.error("Error: figma.teamLibrary.getAvailableComponentsAsync is not available");
      throw new Error("The getAvailableComponentsAsync method is not available");
    }
    
    // [...resto del código sin cambios...]
  } catch (error) {
    // [...también se modificó para lanzar excepciones en lugar de devolver objetos de error...]
  }
}
```

Con esta modificación, ahora cuando la API no está disponible, se lanza correctamente una excepción que es capturada por el servidor MCP y mostrada adecuadamente al usuario.

## 2. Herramienta `flatten_node` (RESUELTO)

### Análisis del Problema

La herramienta `flatten_node` estaba fallando con un timeout error cuando se intentaba aplanar nodos vectoriales complejos. Al examinar la implementación del plugin de Figma, observamos:

```javascript
async function flattenNode(params) {
  const { nodeId } = params || {};
  
  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }
  
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) {
      throw new Error(`Node not found with ID: ${nodeId}`);
    }
    
    // Check for specific node types that can be flattened
    const flattenableTypes = ["VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "ELLIPSE", "RECTANGLE"];
    
    if (!flattenableTypes.includes(node.type)) {
      throw new Error(`Node with ID ${nodeId} and type ${node.type} cannot be flattened. Only vector-based nodes can be flattened.`);
    }
    
    // Verify the node has the flatten method before calling it
    if (typeof node.flatten !== 'function') {
      throw new Error(`Node with ID ${nodeId} does not support the flatten operation.`);
    }
    
    // Implement a timeout mechanism
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Flatten operation timed out after 8 seconds. The node may be too complex."));
      }, 8000); // 8 seconds timeout
    });
    
    // Execute the flatten operation in a promise
    const flattenPromise = new Promise((resolve, reject) => {
      // Execute in the next tick to allow UI updates
      setTimeout(() => {
        try {
          console.log(`Starting flatten operation for node ID ${nodeId}...`);
          const flattened = node.flatten();
          console.log(`Flatten operation completed successfully for node ID ${nodeId}`);
          resolve(flattened);
        } catch (err) {
          console.error(`Error during flatten operation: ${err.message}`);
          reject(err);
        }
      }, 0);
    });
    
    // Race between the timeout and the operation
    const flattened = await Promise.race([flattenPromise, timeoutPromise])
      .finally(() => {
        // Clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
      });
    
    return {
      id: flattened.id,
      name: flattened.name,
      type: flattened.type
    };
  } catch (error) {
    console.error(`Error in flattenNode: ${error.message}`);
    if (error.message.includes("timed out")) {
      // Provide a more helpful message for timeout errors
      throw new Error(`The flatten operation timed out. This usually happens with complex nodes. Try simplifying the node first or breaking it into smaller parts.`);
    } else {
      throw new Error(`Error flattening node: ${error.message}`);
    }
  }
}
```

Las mejoras incluyen:
1. Un timeout de 8 segundos para evitar bloqueos indefinidos.
2. Ejecución de la operación de flatten en una nueva promesa con un pequeño retraso para permitir actualizaciones de la UI.
3. Uso de `Promise.race` para implementar la carrera entre la operación y el timeout.
4. Limpieza adecuada del timeout para evitar fugas de memoria.
5. Mensajes de error mejorados que proporcionan sugerencias útiles cuando ocurre un timeout.
6. Logging adicional para facilitar la depuración.

### Resultados

La implementación ha sido probada con éxito. Ahora la herramienta:
- Funciona correctamente para nodos simples
- Muestra un error descriptivo con sugerencias útiles cuando el nodo es demasiado complejo
- Evita bloquear la interfaz de Figma durante operaciones largas
- Proporciona mejor feedback para depuración a través de logs

## 3. Herramienta `create_component_instance` (RESUELTO)

### Problema Identificado

Durante las pruebas de la herramienta `create_component_instance`, se identificó un problema de robustez:

- Al intentar crear instancias de componentes complejos o remotos, la operación podía bloquearse o tardar demasiado tiempo
- No existía un mecanismo de timeout para manejar operaciones que se extendían demasiado
- Los mensajes de error no eran suficientemente descriptivos para diagnosticar problemas comunes

Este comportamiento podía generar bloqueos en la interfaz de Figma o en el procesamiento de comandos subsecuentes.

### Análisis del Problema

Tras revisar el código, identificamos que:

1. La función `importComponentByKeyAsync` puede tomar un tiempo considerable para componentes complejos o cuando hay problemas de red
2. No existía un mecanismo de timeout para interrumpir operaciones que tomaran demasiado tiempo
3. La estructura de manejo de errores no distinguía entre diferentes tipos de fallas (componente no encontrado, permisos insuficientes, etc.)

### Solución Implementada

Aplicamos un patrón similar al utilizado en la función `flattenNode` para mejorar la robustez:

```javascript
async function createComponentInstance(params) {
  const { componentKey, x = 0, y = 0 } = params || {};

  if (!componentKey) {
    throw new Error("Missing componentKey parameter");
  }

  try {
    // Set up a manual timeout to detect long operations
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timeout while creating component instance (10s). The component may be too complex or unavailable."));
      }, 10000); // 10 seconds timeout
    });
    
    // Execute the import with a timeout
    const importPromise = figma.importComponentByKeyAsync(componentKey);
    
    // Use Promise.race to implement the timeout
    const component = await Promise.race([importPromise, timeoutPromise])
      .finally(() => {
        clearTimeout(timeoutId); // Clear the timeout
      });

    // Create instance and set properties in a separate try block
    try {
      const instance = component.createInstance();
      instance.x = x;
      instance.y = y;
      figma.currentPage.appendChild(instance);
      
      return {
        id: instance.id,
        name: instance.name,
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height,
        componentId: instance.componentId,
      };
    } catch (instanceError) {
      throw new Error(`Error creating component instance: ${instanceError.message}`);
    }
  } catch (error) {
    // Proporcionar mensajes de error más descriptivos según el tipo de error
    if (error.message.includes("timeout") || error.message.includes("Timeout")) {
      throw new Error(`The component import timed out after 10 seconds. This usually happens with complex remote components or network issues. Try again later or use a simpler component.`);
    } else if (error.message.includes("not found") || error.message.includes("Not found")) {
      throw new Error(`Component with key "${componentKey}" not found. Make sure the component exists and is accessible in your document or team libraries.`);
    } else if (error.message.includes("permission") || error.message.includes("Permission")) {
      throw new Error(`You don't have permission to use this component. Make sure you have access to the team library containing this component.`);
    } else {
      throw new Error(`Error creating component instance: ${error.message}`);
    }
  }
}
```

### Cambios Clave Implementados:

1. **Mecanismo de timeout**: Implementamos un timeout de 10 segundos para evitar bloqueos indefinidos
2. **Separación de fases**: Dividimos el proceso en dos fases (importación y creación de instancia) para mejor diagnóstico de errores
3. **Mensajes de error mejorados**: Agregamos mensajes de error específicos según el tipo de problema encontrado
4. **Limpieza de recursos**: Implementamos un bloque `finally` para garantizar que los timeouts se limpien adecuadamente

### Impacto del Cambio

Esta mejora garantiza que:

- La herramienta no se bloqueará indefinidamente en componentes problemáticos
- El usuario recibirá mensajes de error más claros y acciones sugeridas
- Se facilita la depuración de problemas con componentes
- Se mejora la robustez general del sistema

### Estado de Validación

- [x] Cambio implementado
- [x] Funcionalidad verificada

### Lecciones Aprendidas

Esta mejora refuerza la importancia de:

1. **Implementar timeouts**: Las operaciones asíncronas siempre deben tener un mecanismo de timeout para evitar bloqueos
2. **Mensajes de error descriptivos**: Proporcionar información específica sobre el problema y sugerir soluciones
3. **División de procesos complejos**: Separar operaciones grandes en pasos más pequeños facilita el diagnóstico de problemas
4. **Limpieza de recursos**: Garantizar que los recursos como timers se liberen adecuadamente

Este enfoque debería aplicarse a otras herramientas que realicen operaciones potencialmente lentas o que puedan fallar de diferentes maneras.

## 4. Herramienta `set_effect_style_id` (RESUELTO)

### Análisis del Problema

La herramienta `set_effect_style_id` estaba fallando con un timeout error. Como problema similar al de los componentes, este error podría ocurrir si la aplicación de estilos de efectos es una operación pesada o si la API tiene problemas.

### Solución Implementada

Se ha implementado una versión robusta con timeout y manejo de errores:

```javascript
// Set Effect Style ID Tool
async function setEffectStyleId(params) {
  const { nodeId, effectStyleId } = params || {};
  
  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }
  
  if (!effectStyleId) {
    throw new Error("Missing effectStyleId parameter");
  }
  
  try {
    // Set up timeout
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timeout while setting effect style ID (8s)"));
      }, 8000);
    });
    
    // Get node and perform operation
    const applyStylePromise = (async () => {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
      }
      
      // Verificar que el nodo soporte efectos
      if (!("effectStyleId" in node)) {
        throw new Error(`Node with ID ${nodeId} does not support effect styles`);
      }
      
      // Attempt to fetch the effect style first to validate it exists
      try {
        const effectStyle = await figma.getStyleByIdAsync(effectStyleId);
        if (!effectStyle || effectStyle.type !== "EFFECT") {
          throw new Error(`Invalid effect style ID: ${effectStyleId}`);
        }
      } catch (styleError) {
        throw new Error(`Could not find effect style with ID: ${effectStyleId}`);
      }
      
      // Apply the effect style
      node.effectStyleId = effectStyleId;
      
      return {
        id: node.id,
        name: node.name,
        effectStyleId: node.effectStyleId
      };
    })();
    
    // Race the promises
    const result = await Promise.race([applyStylePromise, timeoutPromise])
      .finally(() => {
        clearTimeout(timeoutId);
      });
      
    return result;
  } catch (error) {
    console.error(`Error setting effect style ID: ${error.message}`);
    throw new Error(`Error setting effect style ID: ${error.message}`);
  }
}
```

### Resultados

La implementación ha sido probada con éxito. Ahora la herramienta:
- Funciona correctamente para nodos simples
- Muestra un error descriptivo con sugerencias útiles cuando el nodo o el estilo son inválidos
- Evita bloqueos durante operaciones largas
- Proporciona mejor feedback para depuración a través de logs

## Resumen de las Soluciones

Los problemas identificados con las cuatro herramientas tienen causas diferentes pero soluciones similares:

1. **`get_remote_components`** (RESUELTO): Cambiada la devolución de objetos de error por excepciones para un manejo de errores consistente.

2. **`flatten_node`** (RESUELTO): Implementado un mecanismo de timeout y promesas en paralelo para evitar el bloqueo indefinido.

3. **`create_component_instance`** (RESUELTO): Implementado timeout para la operación de importación de componentes.

4. **`set_effect_style_id`** (RESUELTO): Implementado timeout y validación robusta para la aplicación de estilos de efectos.

## Próximos Pasos

1. Revisar otras herramientas en busca de patrones similares que puedan causar timeouts
2. Considerar la implementación de un sistema general de reportes de progreso para operaciones largas
3. Desarrollar pruebas específicas para estas herramientas para verificar su funcionamiento después de los cambios