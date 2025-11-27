# Backlog de Soluciones para las Herramientas Fallidas

Este documento registra las soluciones implementadas y las pendientes para las herramientas que presentaban fallos después de la refactorización.

## 1. Herramienta `get_remote_components` - RESUELTO ✅

**Fecha de solución**: 4 de mayo de 2025

**Problema detectado**: 
La herramienta fallaba con el error "method not available" cuando la API de `figma.teamLibrary` no estaba disponible o cuando el método `getAvailableComponentsAsync` no existía. Sin embargo, no se manejaba como un error típico, provocando que el servidor MCP no pudiera procesar adecuadamente la respuesta.

**Causa raíz**:
La implementación original devolvía un objeto con flags de error en lugar de lanzar excepciones:

```javascript
if (!figma.teamLibrary) {
  console.error("Error: figma.teamLibrary API is not available");
  return {
    error: true,
    message: "The figma.teamLibrary API is not available in this context",
    apiAvailable: false
  };
}
```

El servidor MCP está diseñado para manejar excepciones lanzadas por las funciones, pero no para interpretar objetos con propiedades de error personalizadas. Esto resultaba en que el error no se mostraba correctamente al usuario.

**Solución implementada**:
Se modificó la implementación para lanzar excepciones explícitas en lugar de devolver objetos de error:

```javascript
if (!figma.teamLibrary) {
  console.error("Error: figma.teamLibrary API is not available");
  throw new Error("The figma.teamLibrary API is not available in this context");
}
```

También se añadió un mecanismo de timeout para evitar que la operación se quedara bloqueada indefinidamente:

```javascript
// Set up a manual timeout to detect deadlocks
let timeoutId;
const timeoutPromise = new Promise((_, reject) => {
  timeoutId = setTimeout(() => {
    reject(new Error("Internal timeout while retrieving remote components (15s)"));
  }, 15000); // 15 seconds internal timeout
});

// Execute the request with a manual timeout
const fetchPromise = figma.teamLibrary.getAvailableComponentsAsync();

// Use Promise.race to implement the timeout
const teamComponents = await Promise.race([fetchPromise, timeoutPromise])
  .finally(() => {
    clearTimeout(timeoutId); // Clear the timeout
  });
```

**Beneficios de la solución**:
1. **Manejo de errores coherente**: El servidor MCP ahora captura y muestra correctamente los errores al usuario.
2. **Prevención de bloqueos**: El mecanismo de timeout evita que la llamada a la API se quede bloqueada indefinidamente.
3. **Mejor experiencia de usuario**: Los mensajes de error son más claros y descriptivos.
4. **Mayor robustez**: La implementación maneja mejor las diferentes condiciones de error.

**Lecciones aprendidas**:
1. Es importante utilizar excepciones para señalizar errores en lugar de objetos de retorno personalizados cuando se trabaja con frameworks que esperan ciertos patrones de manejo de errores.
2. Siempre implementar mecanismos de timeout en operaciones que involucran llamadas a APIs externas para evitar bloqueos.
3. Proporcionar mensajes de error claros y detallados facilita la depuración.

## 2. Herramienta `flatten_node` - RESUELTO ✅

**Fecha de solución**: 4 de mayo de 2025

**Problema detectado**:
La herramienta `flatten_node` fallaba con timeout errors al intentar aplanar nodos vectoriales complejos. La operación podía bloquearse indefinidamente sin proporcionar retroalimentación al usuario.

**Causa raíz**:
La operación `flatten()` de la API de Figma puede ser computacionalmente intensiva, especialmente para nodos vectoriales complejos (como operaciones booleanas complicadas o vectores con muchos puntos). La implementación original no tenía un mecanismo de timeout ni manejo de operaciones de larga duración:

```javascript
// Implementación original problemática
const flattened = node.flatten();
```

Esto podía resultar en que:
1. La interfaz de Figma pareciera congelada
2. La operación no completara dentro del tiempo de timeout del servidor MCP
3. La falta de feedback al usuario sobre el progreso o problemas

**Solución implementada**:
Se ha implementado un sistema robusto de manejo de timeout y promesas en paralelo, junto con mejor feedback al usuario:

```javascript
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
```

Además, se mejoró el manejo de errores para proporcionar mensajes más útiles al usuario:

```javascript
catch (error) {
  console.error(`Error in flattenNode: ${error.message}`);
  if (error.message.includes("timed out")) {
    // Provide a more helpful message for timeout errors
    throw new Error(`The flatten operation timed out. This usually happens with complex nodes. Try simplifying the node first or breaking it into smaller parts.`);
  } else {
    throw new Error(`Error flattening node: ${error.message}`);
  }
}
```

**Beneficios de la solución**:
1. **Prevención de bloqueos indefinidos**: La operación ahora tiene un límite de tiempo definido (8 segundos)
2. **Mejor experiencia de usuario**: Se proporcionan mensajes de error detallados con sugerencias cuando ocurre un timeout
3. **No bloqueo de la UI**: La ejecución diferida permite que la interfaz de Figma siga respondiendo
4. **Evita fugas de memoria**: Limpieza adecuada de recursos después de la operación
5. **Mejor depuración**: Mayor cantidad de logs para facilitar la identificación de problemas

**Lecciones aprendidas**:
1. Las operaciones potencialmente largas en plugins de Figma deben implementar mecanismos de timeout
2. El uso de `Promise.race` es una técnica efectiva para limitar el tiempo de operaciones asíncronas
3. Es importante proporcionar mensajes de error que ayuden al usuario a solucionar el problema (p. ej., "intenta simplificar el nodo")
4. El logging detallado facilita la depuración de problemas en producción
5. Ejecutar operaciones intensivas en un tick separado (con setTimeout(fn, 0)) permite que la UI siga respondiendo

**Impacto en otras herramientas**:
Esta solución sirve como patrón para otras herramientas con problemas similares, como `create_component_instance` y `set_effect_style_id`. El enfoque de manejo de promesas, timeouts y mensajes de error descriptivos puede aplicarse de manera consistente en toda la base de código.

## 3. Herramienta `create_component_instance` - RESUELTO ✅

**Fecha de solución**: 4 de mayo de 2025

**Problema detectado**:
Durante las pruebas de la herramienta `create_component_instance`, se identificó que:

1. **Bloqueos potenciales**: Al importar componentes complejos o remotos, la operación podía bloquearse indefinidamente
2. **Falta de timeout**: No existía un mecanismo para limitar el tiempo de espera en operaciones lentas
3. **Errores no descriptivos**: Los mensajes de error no proporcionaban suficiente contexto para diagnosticar problemas comunes

**Solución implementada**:
Se ha mejorado la función `createComponentInstance` en el archivo `code.js` del plugin de Figma con las siguientes adiciones:

1. **Sistema de timeout**: 
   - Se implementó un timeout de 10 segundos usando `Promise.race()`
   - Esto evita bloqueos indefinidos cuando hay problemas con los componentes
   - Se limpian adecuadamente los timeouts para prevenir fugas de memoria

2. **Separación de la lógica**:
   - Se dividió el proceso en dos fases separadas (importación y creación de instancia)
   - Esto permite diagnosticar con mayor precisión la fuente de los errores

3. **Mensajes de error enriquecidos**:
   - Se implementaron mensajes personalizados según el tipo de error
   - Se agregaron sugerencias de acciones correctivas para el usuario
   - Se clasifican errores por categorías: timeout, componente no encontrado, permisos insuficientes, etc.

4. **Logging mejorado**:
   - Se añadieron logs detallados para facilitar la depuración
   - Se registran eventos clave como inicio y finalización de la importación

**Detalles de Implementación**:
El núcleo de la solución se basa en el uso de promesas en competencia (con `Promise.race`) para establecer un límite de tiempo:

```javascript
// Set up a manual timeout to detect long operations
let timeoutId;
const timeoutPromise = new Promise((_, reject) => {
  timeoutId = setTimeout(() => {
    reject(new Error("Timeout while creating component instance (10s)..."));
  }, 10000); // 10 seconds timeout
});

// Execute the import with a timeout
const importPromise = figma.importComponentByKeyAsync(componentKey);

// Use Promise.race to implement the timeout
const component = await Promise.race([importPromise, timeoutPromise])
  .finally(() => {
    clearTimeout(timeoutId); // Prevent memory leaks
  });
```

Para mejorar el diagnóstico, se implementó un sistema de detección de tipos de error:

```javascript
// Proporcionar mensajes de error más descriptivos según el tipo de error
if (error.message.includes("timeout") || error.message.includes("Timeout")) {
  throw new Error(`The component import timed out after 10 seconds...`);
} else if (error.message.includes("not found") || error.message.includes("Not found")) {
  throw new Error(`Component with key "${componentKey}" not found...`);
} else if (error.message.includes("permission") || error.message.includes("Permission")) {
  throw new Error(`You don't have permission to use this component...`);
} 
```

**Beneficios de la solución**:
1. **Prevención de bloqueos**: La herramienta ya no se queda bloqueada indefinidamente
2. **Mejor diagnóstico**: Los mensajes de error indican específicamente qué puede estar fallando
3. **Sugerencias útiles**: El usuario recibe orientación sobre cómo resolver problemas 
4. **Mayor robustez**: La herramienta maneja de forma elegante condiciones de error

**Pruebas y Validación**:
- Se ha probado la herramienta con componentes locales y verificado su funcionamiento
- Se ha validado el comportamiento de timeout con componentes problemáticos
- Se han verificado los distintos mensajes de error y su utilidad

**Impacto en el Código**:
La modificación es autocontenida y no afecta a otras partes del código. Se ha aplicado el mismo patrón que ya se había utilizado en la solución para `flattenNode`, manteniendo así la consistencia en el enfoque de resolución de problemas.

**Lecciones aprendidas**:
Esta mejora refuerza varios principios importantes de desarrollo:

1. Las operaciones asíncronas deben tener siempre un mecanismo de timeout
2. Los mensajes de error deben ser específicos y orientados a soluciones
3. La separación de operaciones complejas facilita el diagnóstico
4. Es crucial liberar recursos para evitar fugas de memoria

Este mismo patrón de solución podría aplicarse a otras herramientas que realicen operaciones costosas o con potencial de bloqueo.

## 4. Herramienta `set_effect_style_id` - RESUELTO ✅

**Fecha de solución**: 4 de mayo de 2025

**Problema detectado**:
La herramienta `set_effect_style_id` presentaba los siguientes problemas:

1. **Operaciones potencialmente lentas**: Aplicar un estilo de efecto puede ser una operación costosa, especialmente en nodos complejos o cuando involucra efectos elaborados.

2. **Sin manejo de timeout**: La implementación original no tenía un mecanismo para limitar el tiempo de espera, lo que podía resultar en:
   - Bloqueos indefinidos del plugin
   - Fallos silenciosos sin retroalimentación al usuario
   - Comportamiento impredecible del servidor MCP

3. **Validación insuficiente**: No se validaba adecuadamente si el estilo de efecto existía antes de intentar aplicarlo.

4. **Mensajes de error poco descriptivos**: Cuando fallaba, los mensajes de error no proporcionaban información útil para diagnosticar el problema.

**Solución implementada**:
Se ha creado una versión mejorada de la función `setEffectStyleId` que incorpora las siguientes mejoras:

```javascript
async function setEffectStyleId(params) {
  const { nodeId, effectStyleId } = params || {};
  
  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }
  
  if (!effectStyleId) {
    throw new Error("Missing effectStyleId parameter");
  }
  
  try {
    // Set up a manual timeout to detect long operations
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Timeout while setting effect style ID (8s). The operation took too long to complete."));
      }, 8000); // 8 seconds timeout
    });
    
    console.log(`Starting to set effect style ID ${effectStyleId} on node ${nodeId}...`);
    
    // Get node and validate in a promise
    const nodePromise = (async () => {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        throw new Error(`Node not found with ID: ${nodeId}`);
      }
      
      if (!("effectStyleId" in node)) {
        throw new Error(`Node with ID ${nodeId} does not support effect styles`);
      }
      
      // Try to validate the effect style exists before applying
      console.log(`Fetching effect styles to validate style ID: ${effectStyleId}`);
      const effectStyles = await figma.getLocalEffectStylesAsync();
      const foundStyle = effectStyles.find(style => style.id === effectStyleId);
      
      if (!foundStyle) {
        throw new Error(`Effect style not found with ID: ${effectStyleId}. Available styles: ${effectStyles.length}`);
      }
      
      console.log(`Effect style found, applying to node...`);
      
      // Apply the effect style to the node
      node.effectStyleId = effectStyleId;
      
      return {
        id: node.id,
        name: node.name,
        effectStyleId: node.effectStyleId,
        appliedEffects: node.effects
      };
    })();
    
    // Race between the node operation and the timeout
    const result = await Promise.race([nodePromise, timeoutPromise])
      .finally(() => {
        // Clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
      });
    
    console.log(`Successfully set effect style ID on node ${nodeId}`);
    return result;
  } catch (error) {
    console.error(`Error setting effect style ID: ${error.message || "Unknown error"}`);
    console.error(`Stack trace: ${error.stack || "Not available"}`);
    
    // Proporcionar mensajes de error específicos para diferentes casos
    if (error.message.includes("timeout") || error.message.includes("Timeout")) {
      throw new Error(`The operation timed out after 8 seconds. This could happen with complex nodes or effects. Try with a simpler node or effect style.`);
    } else if (error.message.includes("not found") && error.message.includes("Node")) {
      throw new Error(`Node with ID "${nodeId}" not found. Make sure the node exists in the current document.`);
    } else if (error.message.includes("not found") && error.message.includes("style")) {
      throw new Error(`Effect style with ID "${effectStyleId}" not found. Make sure the style exists in your local styles.`);
    } else if (error.message.includes("does not support")) {
      throw new Error(`The selected node type does not support effect styles. Only certain node types like frames, components, and instances can have effect styles.`);
    } else {
      throw new Error(`Error setting effect style ID: ${error.message}`);
    }
  }
}
```

### Características clave de la solución:

1. **Sistema de timeout robusto**: 
   - Implementación de un timeout de 8 segundos utilizando `Promise.race`
   - Limpieza adecuada del timeout mediante `.finally()` para evitar fugas de memoria

2. **Validación previa**:
   - Verificación de la existencia del nodo antes de intentar aplicar el estilo
   - Comprobación de que el nodo soporte estilos de efectos
   - Validación de que el estilo de efecto exista mediante `figma.getLocalEffectStylesAsync()`

3. **Mensajes de error específicos**:
   - Categorización de los errores para proporcionar mensajes más útiles
   - Sugerencias personalizadas según el tipo de error
   - Información detallada para facilitar la depuración

4. **Registro mejorado**:
   - Incorporación de mensajes de log detallados para facilitar la depuración
   - Captura y registro de la pila de llamadas cuando ocurren errores

**Motivos de la Implementación**

Esta solución se implementó siguiendo un patrón consistente con las otras tres herramientas que presentaban problemas similares:

1. **Consistencia**: Mantener un enfoque uniforme para el manejo de operaciones potencialmente lentas.

2. **Robustez**: Garantizar que la herramienta nunca se quede bloqueada indefinidamente.

3. **Experiencia de usuario**: Proporcionar retroalimentación clara y útil cuando ocurren problemas.

4. **Mantenibilidad**: Seguir un patrón de diseño común facilita el mantenimiento futuro.

**Beneficios de la Solución**

Esta implementación proporciona varias ventajas:

1. **Prevención de bloqueos**: El usuario nunca experimentará bloqueos indefinidos.

2. **Diagnóstico más fácil**: Los mensajes de error específicos facilitan la identificación de problemas.

3. **Mayor transparencia**: El sistema de registro proporciona información detallada para depuración.

4. **Mejor manejo de recursos**: La limpieza adecuada de los timeouts previene fugas de memoria.

**Validación**

La solución ha sido probada satisfactoriamente en diversos escenarios:

- Aplicación de estilos de efectos válidos a nodos compatibles
- Intentos de aplicar estilos a nodos inexistentes
- Intentos de aplicar estilos inexistentes
- Intentos de aplicar estilos a nodos que no soportan efectos

En todos los casos, la herramienta responde correctamente con un resultado exitoso o un mensaje de error descriptivo.

**Conclusión**

Con esta implementación, se completa la corrección de las cuatro herramientas que presentaban problemas de timeout, siguiendo un patrón de diseño consistente. La herramienta `set_effect_style_id` ahora es robusta ante condiciones adversas y proporciona una experiencia de usuario mejorada.

## Estrategia general para implementaciones futuras

Para las herramientas pendientes y futuras mejoras, se recomienda seguir estos principios:

1. **Manejo consistente de errores**: Usar excepciones en lugar de objetos de error personalizados
2. **Implementar timeouts**: Para todas las operaciones que podrían bloquearse
3. **Validación robusta**: Verificar parámetros y disponibilidad de APIs antes de usarlas
4. **Logging detallado**: Registrar información de diagnóstico para facilitar la depuración
5. **Respuestas progresivas**: Para operaciones largas, proporcionar actualizaciones de progreso
6. **Ejecución no bloqueante**: Ejecutar operaciones intensivas en promesas separadas para mantener la UI responsiva
7. **Limpieza de recursos**: Asegurar que todos los recursos (como timeouts) se liberen correctamente

Esta estrategia ayudará a mantener la consistencia en el código y asegurará una experiencia más robusta para los usuarios del plugin.