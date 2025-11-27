# Backlog del Proceso de Refactorización

Este documento registra el progreso y las decisiones tomadas durante la refactorización del archivo `server.ts` en módulos más pequeños y mantenibles.

## Paso 2: Extracción de Tipos y Configuración ✅

### Fecha: 4 de mayo de 2025

### Archivos creados:
1. `/src/talk_to_figma_mcp/types/index.ts`
2. `/src/talk_to_figma_mcp/config/config.ts`

### Cambios realizados:

#### 1. Creación del archivo `types/index.ts`:
- Extraídas todas las interfaces y tipos del archivo original, incluyendo:
  - `FigmaResponse`: Interfaz para las respuestas de Figma
  - `CommandProgressUpdate`: Interfaz para las actualizaciones de progreso de comandos
  - `PendingRequest`: Interfaz para seguimiento de peticiones WebSocket
  - `ProgressMessage`: Interfaz para mensajes de progreso
  - `FigmaCommand`: Tipo que enumera todos los comandos de Figma soportados
- Se han mantenido los nombres originales para facilitar la refactorización posterior

#### 2. Creación del archivo `config/config.ts`:
- Extraída toda la lógica de configuración del servidor:
  - Procesamiento de argumentos de línea de comandos (`--server`, `--port`, `--reconnect-interval`)
  - Valores de configuración como `serverUrl`, `defaultPort`, y `reconnectInterval`
  - URL de WebSocket (`WS_URL`) basada en el entorno
  - Configuración del servidor MCP (nombre, descripción, versión)
- Se ha añadido una constante `SERVER_CONFIG` que agrupa la configuración del servidor MCP

### Decisiones de diseño:
- **Tipos**: Se han extraído todos los tipos en un solo archivo `index.ts` para facilitar su importación desde otros módulos
- **Configuración**: Se ha elegido un enfoque centralizado para los parámetros de configuración, siguiendo el principio de tener un único lugar para todas las constantes y configuraciones
- **Nombres de exportación**: Se han mantenido los mismos nombres de variables y constantes para minimizar los cambios necesarios en el resto del código
- **Importaciones**: Se ha conservado la dependencia de `zod` en el archivo de configuración para mantener la coherencia con el código original

### Próximos pasos:
- Extraer las utilidades (logger, figma-helpers, websocket)
- Modificar las herramientas para que utilicen los tipos y configuraciones extraídos
- Actualizar el archivo principal `server.ts` para importar los nuevos módulos

### Impacto en el código existente:
- Esta fase no modifica la funcionalidad del código
- Los próximos pasos deberán actualizar las importaciones para usar los nuevos módulos
- Al mantener los mismos nombres de tipos y variables, se minimiza el impacto de los cambios

## Paso 3: Extracción de Utilidades ✅

### Fecha: 4 de mayo de 2025

### Archivos creados:
1. `/src/talk_to_figma_mcp/utils/logger.ts`
2. `/src/talk_to_figma_mcp/utils/figma-helpers.ts`
3. `/src/talk_to_figma_mcp/utils/websocket.ts`

### Cambios realizados:

#### 1. Creación del archivo `utils/logger.ts`:
- Extraídas las funciones de logging que escriben en stderr:
  - Se ha creado un objeto `logger` con métodos para distintos niveles: `info`, `debug`, `warn`, `error` y `log`
  - Todos los métodos escriben en `stderr` en lugar de `stdout` para evitar interferir con la comunicación MCP

#### 2. Creación del archivo `utils/figma-helpers.ts`:
- Extraídas las funciones auxiliares para procesar datos de Figma:
  - `rgbaToHex`: Para convertir colores RGBA a formato hexadecimal
  - `filterFigmaNode`: Para filtrar y simplificar los nodos de Figma, reduciendo su complejidad
  - `processFigmaNodeResponse`: Para procesar respuestas de nodos de Figma con fines de logging
- Se ha añadido documentación JSDoc a todas las funciones para mejorar la comprensión

#### 3. Creación del archivo `utils/websocket.ts`:
- Extraída toda la lógica de WebSocket:
  - Variables de estado (`ws`, `currentChannel`, `pendingRequests`)
  - `connectToFigma`: Para establecer la conexión con el servidor de Figma
  - `joinChannel`: Para unirse a un canal específico
  - `sendCommandToFigma`: Para enviar comandos a Figma y manejar las respuestas
  - Se ha añadido un nuevo método `getCurrentChannel` para obtener el canal actual
- Se han organizado los manejadores de eventos WebSocket:
  - Eventos `open`, `message`, `error` y `close`
  - Lógica para los timeouts de conexión y reconexión automática

### Decisiones de diseño:
- **Modularidad**: Cada archivo tiene una responsabilidad clara y específica
- **Encapsulamiento**: Las variables de estado como `ws` y `currentChannel` están encapsuladas en el módulo websocket
- **Documentación**: Se ha añadido documentación JSDoc a las funciones principales para mejorar la comprensión
- **Tipado**: Se han utilizado los tipos definidos en el paso anterior para asegurar la consistencia
- **Gestión de errores**: Se ha mejorado la gestión de errores con mensajes más descriptivos

### Mejoras realizadas:
- Se ha añadido un método `getCurrentChannel()` que no existía en el código original
- Se ha mejorado la documentación de las funciones con JSDoc
- Se han organizado las importaciones de forma más clara y específica
- Se han tipado correctamente los parámetros y retornos de las funciones

### Próximos pasos:
- Organizar las herramientas por categorías (document-tools, creation-tools, etc.)
- Organizar los prompts en un módulo separado
- Refactorizar el archivo principal `server.ts` para utilizar los nuevos módulos

### Impacto en el código existente:
- Las utilidades extraídas pueden ser importadas y utilizadas por las herramientas
- La separación del WebSocket facilita las pruebas unitarias al poder mock-ear la conexión
- La separación del logger permite cambiar la implementación del logging en el futuro sin afectar al resto del código

## Punto 4: Organizar Herramientas por Categorías ✅ (04-05-2025)

Se ha completado la organización de las herramientas en archivos separados según su categoría. Se han creado los siguientes archivos:

- **document-tools.ts**: Contiene herramientas relacionadas con información del documento, selección, y exportación de imágenes
  - `get_document_info`: Obtener información del documento
  - `get_selection`: Obtener selección actual
  - `get_node_info`: Obtener información de un nodo específico
  - `get_nodes_info`: Obtener información de múltiples nodos
  - `get_styles`: Obtener estilos
  - `get_local_components`: Obtener componentes locales
  - `get_remote_components`: Obtener componentes remotos
  - `scan_text_nodes`: Escanear nodos de texto
  - `join_channel`: Unirse a un canal
  - `export_node_as_image`: Exportar nodo como imagen

- **creation-tools.ts**: Contiene herramientas para crear elementos en Figma
  - `create_rectangle`: Crear rectángulo
  - `create_frame`: Crear frame
  - `create_text`: Crear texto
  - `create_ellipse`: Crear elipse
  - `create_polygon`: Crear polígono
  - `create_star`: Crear estrella
  - `group_nodes`: Agrupar nodos
  - `ungroup_nodes`: Desagrupar nodos
  - `clone_node`: Clonar nodo
  - `insert_child`: Insertar nodo hijo
  - `flatten_node`: Aplanar nodo

- **modification-tools.ts**: Contiene herramientas para modificar elementos existentes
  - `set_fill_color`: Establecer color de relleno
  - `set_stroke_color`: Establecer color de borde
  - `move_node`: Mover nodo
  - `resize_node`: Redimensionar nodo
  - `delete_node`: Eliminar nodo
  - `set_corner_radius`: Establecer radio de esquina
  - `set_auto_layout`: Configurar auto layout
  - `set_effects`: Establecer efectos
  - `set_effect_style_id`: Aplicar estilo de efecto

- **text-tools.ts**: Contiene herramientas específicas para trabajar con texto
  - `set_text_content`: Establecer contenido de texto
  - `set_multiple_text_contents`: Establecer múltiples contenidos de texto
  - `set_font_name`: Establecer nombre de fuente
  - `set_font_size`: Establecer tamaño de fuente
  - `set_font_weight`: Establecer peso de fuente
  - `set_letter_spacing`: Establecer espaciado entre letras
  - `set_line_height`: Establecer altura de línea
  - `set_paragraph_spacing`: Establecer espaciado de párrafo
  - `set_text_case`: Establecer mayúsculas/minúsculas
  - `set_text_decoration`: Establecer decoración de texto
  - `get_styled_text_segments`: Obtener segmentos de texto con estilos
  - `load_font_async`: Cargar fuente asíncronamente

- **component-tools.ts**: Contiene herramientas para trabajar con componentes
  - `create_component_instance`: Crear instancia de componente

Además, se ha creado un archivo **index.ts** que exporta todas las categorías de herramientas y proporciona una función unificada `registerTools` para registrar todas las herramientas a la vez.

Esta organización por categorías facilita:
1. Ubicar rápidamente herramientas relacionadas
2. Mantener y actualizar código relacionado en un solo lugar
3. Reutilizar funcionalidades comunes entre herramientas similares
4. Escalar el proyecto añadiendo nuevas herramientas en sus categorías correspondientes

## Punto 5: Organizar Prompts ✅

### Fecha: 4 de mayo de 2025

### Archivos creados:
1. `/src/talk_to_figma_mcp/prompts/index.ts`

### Cambios realizados:

#### 1. Creación del archivo `prompts/index.ts`:
- Extraídos los tres prompts del archivo original:
  - `design_strategy`: Mejores prácticas para trabajar con diseños de Figma
  - `read_design_strategy`: Mejores prácticas para leer diseños de Figma
  - `text_replacement_strategy`: Enfoque sistemático para reemplazar texto en diseños de Figma
- Implementación de una función principal `registerPrompts` que registra todos los prompts a la vez
- Exportación de funciones individuales para registrar cada prompt por separado si fuera necesario:
  - `registerDesignStrategyPrompt`
  - `registerReadDesignStrategyPrompt`
  - `registerTextReplacementStrategyPrompt`

### Decisiones de diseño:
- **Organización centralizada**: Todos los prompts están en un único archivo para facilitar su mantenimiento
- **Función unificada**: La función `registerPrompts` permite registrar todos los prompts con una sola llamada
- **Funciones individuales**: También se exportan funciones para cada prompt individual por si se necesita más flexibilidad
- **Documentación mejorada**: Se ha añadido documentación JSDoc para explicar el propósito del módulo y sus funciones

### Mejoras realizadas:
- Centralización de todos los prompts en un único módulo
- Facilidad para añadir nuevos prompts en el futuro
- Mejora de la documentación mediante JSDoc

### Próximos pasos:
- Refactorizar el archivo principal `server.ts` para utilizar los prompts extraídos
- Considerar si se necesitan más categorías de prompts para organizar mejor el código si crece
- Explorar la posibilidad de cargar prompts desde archivos externos para mayor flexibilidad

### Impacto en el código existente:
- El archivo principal `server.ts` se simplificará al extraer la definición de prompts
- Se mantiene la funcionalidad exacta de los prompts originales
- La interfaz para añadir nuevos prompts es clara y consistente

## Punto 6: Refactorizar el Archivo Principal ✅

### Fecha: 4 de mayo de 2025

### Archivos modificados:
1. `/src/talk_to_figma_mcp/server.ts`

### Cambios realizados:

#### 1. Refactorización del archivo `server.ts`:
- Reducción del archivo de más de 2500 líneas a aproximadamente 50 líneas
- Implementación de un nuevo punto de entrada principal que:
  - Importa la configuración desde `config/config.ts`
  - Importa las utilidades desde `utils/logger.ts` y `utils/websocket.ts`
  - Importa la función `registerTools` desde `tools/index.ts`
  - Importa la función `registerPrompts` desde `prompts/index.ts`
  - Inicializa el servidor MCP con la configuración importada
  - Registra todas las herramientas y prompts usando las funciones importadas
  - Intenta conectar con Figma
  - Inicia el servidor MCP con el transporte stdio

### Decisiones de diseño:
- **Punto de entrada mínimo**: El archivo principal ahora solo contiene el código necesario para inicializar y configurar el servidor, delegando toda la funcionalidad a módulos especializados
- **Inicialización ordenada**: La secuencia de inicialización es clara y sigue un orden lógico: crear servidor → registrar herramientas → registrar prompts → conectar con Figma → iniciar servidor
- **Manejo de errores robusto**: Se han implementado bloques try-catch a múltiples niveles para garantizar que los errores se manejen adecuadamente
- **Documentación mejorada**: Se han añadido comentarios explicativos para cada sección del código

### Mejoras realizadas:
- **Reducción significativa de tamaño**: El archivo principal se ha reducido aproximadamente un 98%
- **Mayor claridad**: La estructura del servidor y su inicialización ahora son mucho más fáciles de entender
- **Mejor separación de responsabilidades**: Cada parte del código ahora reside en su módulo correspondiente
- **Mantenibilidad mejorada**: Cualquier cambio futuro requerirá modificar solo el módulo específico, no el archivo principal

### Próximos pasos:
- Realizar pruebas exhaustivas para verificar que el servidor funciona correctamente con la nueva estructura
- Considerar la creación de scripts de construcción específicos para la nueva estructura
- Evaluar la necesidad de pruebas unitarias para cada módulo
- Actualizar la documentación del proyecto para reflejar la nueva arquitectura

### Impacto en el código existente:
- El comportamiento externo del servidor se mantiene exactamente igual
- Los clientes que utilicen el servidor no deberían notar ninguna diferencia
- La nueva estructura facilitará enormemente futuras ampliaciones y modificaciones