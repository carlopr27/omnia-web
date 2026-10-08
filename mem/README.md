# Memora / Remento · MVP 0.2B.2

**Entrada siempre nueva + lista de recuerdos + página para abrir cada recuerdo.** Conserva grabación hasta tres minutos, Drive/Sheets, transcripción automática e historia con AssemblyAI Qwen.

## Actualizar tu instalación

1. Conserva tu carpeta, Sheet, Prompts y Script Properties. Haz copia de Code.gs/Sheet antes de sustituirlos.
2. Sustituye **Code.gs** por `apps-script/Code.gs`. El manifiesto tiene los mismos permisos que 0.2B.1.
3. Ejecuta **setupMvp**. Añade `memory_page_url` a Videos y crea los enlaces para las filas anteriores que ya tienen memory_id/access_token. No borra ni regenera los videos/textos. Conserva los prompts editados y el activador processPending de cada minuto.
4. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**. Conserva ejecutar como Yo, acceso Cualquier persona y la URL /exec de la implementación.
5. En `mem/` de `omnia-web`, sustituye **index.html, app.js, styles.css** y añade **memory-store.js, library.js, recuerdos.html, memory.html**.
6. **Conserva tu config.js actual** con la URL /exec válida. El config.js del ZIP es solo un ejemplo para una instalación nueva.
7. Espera la publicación de GitHub Pages y recarga https://omniaex.com/mem/index.html. Debe mostrar **0.2B.2**, las preguntas y el grabador, sin abrir el resultado anterior.

Los scripts/estilos llevan versión en su URL para evitar la caché anterior. El front comprueba la versión de Apps Script y avisa si falta redesplegarlo.

Propiedades que conservas: APP_ORIGIN = `https://omniaex.com`, ASSEMBLYAI_API_KEY (solo en Script Properties), SPREADSHEET_ID y DRIVE_FOLDER_ID existentes.

Opcional: **MEMORY_PAGE_URL** cambia la URL del visor. Para tu sitio no hace falta: por defecto es APP_ORIGIN + `/mem/memory.html`. Si usas otra ruta, indica la URL HTTPS completa terminada en .html, sin # ni parámetros, y ejecuta setupMvp de nuevo para actualizar los enlaces.

## Las tres páginas

- **index.html:** siempre comienza una grabación nueva. Guarda y procesa automáticamente el video → transcripción → historia. Al recargar vuelve al grabador, aunque exista un resultado anterior.
- **recuerdos.html:** lista los recuerdos guardados/abiertos en **ese navegador**. Cada tarjeta permite abrir el recuerdo. También puedes pegar un enlace para añadirlo y abrirlo.
- **memory.html:** muestra un recuerdo identificado por su enlace, con video, transcripción original e historia editada. Si está procesándose, continúa consultando su estado.

Después de guardar, **Abrir página del recuerdo** y **Copiar enlace del recuerdo** permiten conservarlo. Copiar al portapapeles puede requerir permiso del navegador; si falla, copia manualmente la dirección de Abrir página del recuerdo.

## Recuperar los anteriores

Después de setupMvp, abre tu Sheet → **Videos → memory_page_url**. Copia el enlace de la fila que deseas y ábrelo. Recupera los datos ya guardados; no necesitas grabar ni transcribir otra vez. Abrirlo añade ese recuerdo a la lista local. La última referencia de 0.2A/0.2B guardada en el navegador se migra a Recuerdos, sin abrirla automáticamente.

Los recuerdos antiguos que no tenían historia siguen mostrando el botón Crear historia. Las grabaciones que el error anterior nunca llegó a guardar no se pueden recuperar desde Drive.

Formato de un enlace (usa los valores reales que genera el Sheet):

```text
https://omniaex.com/mem/memory.html#id=UUID_DEL_RECUERDO&token=UUID_DE_ACCESO
```

Es **una sola página HTML** que lee distintos registros de Apps Script según el enlace. No hay que subir un HTML, hacer un commit ni desplegar GitHub por cada grabación. GitHub sirve la interfaz; Sheets almacena los textos y Drive el video. El fragmento después de # no se envía en la petición HTTP inicial a GitHub; el código manda ID/token a Apps Script por POST.

## Lista, enlaces y permisos

La lista es **por navegador**, no por persona/cuenta. No hay login ni perfiles en esta versión. En un navegador compartido, quien abra Recuerdos podrá ver sus referencias guardadas. La entrada a Grabar nunca las abre automáticamente. En otro navegador, la lista comienza vacía hasta grabar o abrir/importar un enlace.

Quien tenga el enlace completo puede abrir el texto: el token es un permiso de acceso. Guarda los enlaces y el Sheet con cuidado. No hay un endpoint público para enumerar los recuerdos de todas las personas. La lista guarda referencias y resúmenes locales, y el visor obtiene el contenido actual desde Sheets. Una tarjeta puede conservar un título anterior hasta volver a abrir ese recuerdo.

El video conserva sus permisos de **Drive**; copiar el enlace del recuerdo no lo hace público. Otra persona necesita permiso sobre el archivo para reproducirlo. Si el iframe pide acceso, comparte el archivo con su cuenta o usa Abrir video estando conectado a una cuenta autorizada.

Al borrar los datos del navegador se pierde la lista, pero los archivos/textos permanecen en Drive/Sheets: recupéralos con memory_page_url. Eliminar una fila/archivo o cambiar access_token puede invalidar un enlace previo. El endpoint de Apps Script sigue siendo público para pruebas controladas; APP_ORIGIN no sustituye autenticación ni protección contra abuso.

## Lo que se conserva de 0.2B.1

Cada captura nueva tiene su propio ID/token, aunque responda la misma pregunta. Solo un reintento de guardar **el mismo Blob** conserva el ID. Apps Script compara SHA-256 y rechaza videos distintos con un ID reutilizado.

La transcripción se solicita al guardar. El front consulta cada cinco segundos después de la respuesta anterior; processPending sigue trabajando cada minuto al cerrar la página. Para consultar después, abre el recuerdo desde su enlace/lista. El flujo es **Grabar → Revisar → Guardar video → Transcripción original → Historia editada**.

`status` (VIDEO_SAVED, TRANSCRIBING, READY, ERROR) describe la transcripción. `story_status` (PENDING, GENERATING, READY, ERROR, SKIPPED, NOT_REQUESTED) describe la historia. Un fallo de historia conserva el video/transcript y ofrece Reintentar historia sin volver a subir/transcribir. Un transcript vacío omite el LLM. Repetir una solicitud de historia ya en curso/lista no la duplica.

El prompt vive en **Prompts**, con exactamente una fila activa. Campos: prompt_id, name, active, model, max_tokens, temperature, prompt. Valores iniciales: STORY_V1, qwen3.5-4b-32k-fast, 1800 tokens y temperature 0.2. Conserva `{{ question }}` y `{{ transcript }}`; Apps Script sustituye ambas. La salida debe tener solo `title` y `story` como texto. Puedes editar reglas sin desplegar; se aplican al siguiente intento y no reescriben historias listas. El sistema guarda un snapshot del template/modelo/settings por intento.

El prompt pide primera persona, idioma original, conservar detalles/dudas y no inventar hechos. Revisa el resultado con el video. PROMPT-STORY-V1.txt es una copia de consulta; el sistema usa la celda de Sheets. Se solicita JSON por prompt y se valida en el servidor; no se fuerza json_schema para esa variante de Qwen. HTTP 429 permite tres intentos con espera. Otros fallos o respuestas inválidas requieren reintento explícito y pueden consumir créditos adicionales.

La key permanece en Script Properties. No hay fallback a otro modelo ni cambios de plan/saldo. El [Quickstart](https://www.assemblyai.com/docs/llm-gateway/quickstart) utiliza el modelo elegido y la [hoja de ruta](https://www.assemblyai.com/roadmap) anuncia acceso gratuito a Gateway desde agosto de 2026; esto no confirma cómo tu cuenta aplica los $50 iniciales al LLM. Comprueba acceso y consumo en tu primera prueba real.

## Comprobación después de instalar

1. Con recuerdos antiguos en el navegador, abre index.html y espera diez segundos. Debe quedarse en el grabador.
2. Abre Recuerdos y elige un resultado previo. Debe mostrar el video y sus textos.
3. Copia memory_page_url de otra fila del Sheet y ábrelo. Vuelve a Recuerdos: debe haberse añadido a la lista.
4. Graba un video nuevo, guarda y espera los textos. Copia su enlace y abre otra pestaña.
5. Graba otra respuesta para la misma pregunta: debe crear otro recuerdo. Recarga index.html: vuelve al grabador; los dos resultados siguen en Recuerdos.
6. Desde otro navegador, abre/importa un enlace para recuperar ese recuerdo. Comprueba también los permisos del video en Drive.

**Validación:** 51 pruebas locales con servicios, DOM y cámara simulados: 24 de servidor, 11 de interfaz, 9 de grabación y 7 de visor/lista. Sintaxis y manifiesto verificados. No publicamos cambios ni hicimos llamadas reales con tu clave; falta probar la instalación real.

```text
node tests/backend.test.cjs
node tests/frontend.test.cjs
node tests/recording-regression.test.cjs
node tests/viewer-library.test.cjs
```

Archivos web: index.html, memory.html, recuerdos.html, app.js, memory-store.js, library.js, styles.css, config.js. Apps Script: Code.gs/appsscript.json. Incluye pruebas, instrucciones y copia del prompt.

[GitHub Pages sirve HTML, CSS y JavaScript estáticos](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages); las distintas vistas por enlace están implementadas en este paquete.
