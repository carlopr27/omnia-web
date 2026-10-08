# Memora / Remento · MVP 0.2B.3

**Recuerdos compartidos desde cualquier computadora, por secciones y personas, sin cuentas ni claves de acceso.** La página principal siempre abre el grabador. Recuerdos consulta los datos del Sheet, en lugar de depender de la lista local del navegador.

## Actualizar tu instalación

1. Conserva tu carpeta de Drive, Sheet, Prompts, config.js y Script Properties. Haz copia del código/Sheet antes de sustituirlos.
2. Reemplaza **Code.gs** por `apps-script/Code.gs` del paquete. El manifiesto conserva los mismos permisos anteriores.
3. Ejecuta **setupMvp** manualmente. Añade `participant_name`, `section`, `memory_page_url` a Videos y `section` a Questions, conserva tus filas/prompts y rellena los enlaces de los recuerdos anteriores. No regenera ni elimina los videos/textos.
4. setupMvp crea **MVP_SHARED_MODE = true** en Script Properties si no existía. Para esta prueba debe estar en `true`. Si ya existía en `false`, cámbialo a `true` y vuelve a ejecutar setupMvp.
5. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**. Conserva ejecutar como Yo, acceso Cualquier persona y la misma URL /exec.
6. Sube/sustituye en `mem/` estos **siete archivos**: index.html, memory.html, recuerdos.html, app.js, api.js, library.js y styles.css. **Conserva tu config.js actual**, con la URL /exec que funciona. El config.js del ZIP solo es un ejemplo para instalación nueva. El archivo memory-store.js de 0.2B.2 puede permanecer en GitHub; esta versión ya no lo utiliza.
7. Espera a que GitHub Pages publique y abre https://omniaex.com/mem/index.html. Debe decir **MVP 0.2B.3**. Al entrar permanece el grabador, sin recuperar automáticamente una historia terminada.
8. Pulsa **Recuerdos** o abre https://omniaex.com/mem/recuerdos.html. Verás los recuerdos guardados en Sheets, también desde un navegador nuevo o en incógnito.

JS/CSS tienen versión en su URL para evitar caché anterior. La web comprueba la versión de Apps Script; si falta publicar el servidor nuevo, avisa antes de grabar.

Propiedades que mantienes:

| Propiedad | Valor |
| --- | --- |
| APP_ORIGIN | `https://omniaex.com` |
| ASSEMBLYAI_API_KEY | Tu clave válida, solo en Apps Script |
| SPREADSHEET_ID | Tu Sheet existente |
| DRIVE_FOLDER_ID | Tu carpeta de videos |
| MVP_SHARED_MODE | `true` para esta prueba sin cuentas |

Opcional: MEMORY_PAGE_URL permite configurar otro destino para los enlaces. Por defecto es APP_ORIGIN + `/mem/memory.html`. Si cambias de ruta, indica URL HTTPS completa terminada en .html, sin # ni parámetros, y ejecuta setupMvp para actualizar los enlaces.

## Secciones y personas

En la pestaña **Questions**, edita la nueva columna **section** para cada pregunta. Ejemplos: **Infancia**, **Familia**, **Trabajo**, **Viajes**. Las preguntas existentes sin sección aparecen en **Otros recuerdos**. Las secciones se organizan con esas etiquetas, no mediante clasificación de IA.

Editar section actualiza la agrupación de los recuerdos de esa pregunta al pulsar Actualizar lista; no necesitas volver a desplegar. No cambies los IDs de las preguntas. Los títulos/secciones vacíos no impiden abrir un recuerdo.

Antes de grabar, cada persona puede escribir su nombre en el campo **Tu nombre (opcional)**. Se guarda con el video y permite filtrar la lista por persona. No es una cuenta ni pide contraseña. Si falta, aparece **Sin nombre**. Puedes completar participant_name de una fila antigua en Videos y actualizar la lista para identificar pruebas anteriores.

Recuerdos tiene filtros **Sección** y **Persona**. Los resultados se agrupan por sección y se ordenan del más reciente al más antiguo dentro de cada una. Actualizar lista consulta de nuevo el Sheet, por lo que aparecen videos guardados desde otros dispositivos. Consultar la lista no hace llamadas a AssemblyAI ni regenera historias.

## Qué ve cada persona

Este es un **espacio compartido de prueba**: todos los que abran la página Recuerdos podrán ver los títulos, nombres, preguntas y, al abrir un recuerdo, sus transcripciones/historias. Los enlaces no requieren introducir claves. No se distinguen usuarios con permisos privados.

Los videos mantienen sus permisos de **Drive**. Esta actualización no convierte automáticamente los archivos en públicos. Para que los probadores vean el video, comparte la carpeta/archivos con sus cuentas de Google, o cambia manualmente los permisos del archivo a Cualquier persona con el enlace si quieres permitir su reproducción sin cuenta. El texto del recuerdo sí es visible desde el espacio compartido. Un iframe de Drive puede pedir acceso o requerir Abrir video en una pestaña aparte según cookies/permisos.

La clave de **AssemblyAI** sigue en Script Properties y nunca se devuelve a la web. El modo compartido habilita deliberadamente la consulta de recuerdos por ID sin token, la lista de recuerdos y los reintentos del procesamiento desde su página. Los reintentos de IA pueden consumir créditos. La lista no devuelve tokens de acceso ni claves del proveedor. APP_ORIGIN controla el destino de la respuesta pero no es autenticación.

Para desactivar el acceso compartido, pon MVP_SHARED_MODE en `false` y ejecuta setupMvp. La lista dejará de estar disponible y abrir sin token se rechazará; los archivos/textos no se borran. Los enlaces privados anteriores con token válido seguirán funcionando. Esto no añade cuentas ni una lista privada por persona; ese sería un desarrollo posterior.

## Página de cada recuerdo y resultados anteriores

Después de guardar puedes pulsar **Abrir página del recuerdo** o **Copiar enlace**. También puedes abrirlo desde la lista. Su URL tiene este formato:

```text
https://omniaex.com/mem/memory.html#id=IDENTIFICADOR_DEL_RECUERDO
```

Es una sola página estática que consulta el registro correspondiente de Apps Script. No hace falta crear un HTML ni hacer un commit en GitHub por cada video. Los textos permanecen en Sheets y el video en Drive.

setupMvp rellena **Videos → memory_page_url** para los recuerdos existentes con memory_id/access_token. Puedes abrir esos enlaces desde el Sheet. Los enlaces antiguos que incluían token también son compatibles. Las grabaciones 0.2A sin historia muestran Crear historia de este recuerdo. Si una grabación nunca se guardó por el error antiguo, no se puede recuperar de Drive.

## Flujo y ajustes que se mantienen

**Grabar → Revisar → Guardar video → Transcripción original → Historia editada**, sin un botón adicional entre etapas para videos nuevos. Máximo tres minutos. Cada captura tiene ID independiente aunque responda la misma pregunta. Un reintento del mismo Blob conserva su ID; SHA-256 evita devolver silenciosamente un video distinto con ese identificador.

La transcripción se solicita al guardar. El front consulta cada cinco segundos después de cada respuesta. processPending continúa cada minuto al salir de la página. Para consultar el resultado después abre Recuerdos; index.html siempre vuelve al grabador.

status guarda VIDEO_SAVED / TRANSCRIBING / READY / ERROR para la transcripción; story_status guarda PENDING / GENERATING / READY / ERROR / SKIPPED / NOT_REQUESTED para la historia. Un fallo de LLM conserva video/transcript. Reintentar historia no vuelve a subir/transcribir el video. Un transcript vacío no se envía al LLM.

El modelo es **qwen3.5-4b-32k-fast**, sin fallback a otro proveedor/modelo. El prompt vive en **Prompts**: activa exactamente una fila y conserva `{{ question }}` y `{{ transcript }}`. Campos: prompt_id, name, active, model, max_tokens, temperature, prompt. Los valores iniciales son STORY_V1, 1800 tokens y temperatura 0.2. Admite 400–3000 tokens y temperatura 0–1.

La respuesta se solicita como JSON con title/story y se valida en el servidor. Se guarda snapshot de prompt/modelo/settings por intento. No se fuerza json_schema en esa variante del modelo. Puedes modificar las reglas sin redesplegar; se aplican al siguiente intento y no reescriben historias listas. Revisa que la historia no añada hechos que no se dijeron. El archivo PROMPT-STORY-V1.txt es una copia; la aplicación usa la celda de Sheets.

No se cambia el plan/saldo de AssemblyAI. Verifica acceso y consumo en tu cuenta. HTTP 429 permite tres intentos con espera; otras respuestas inválidas o llamadas sin confirmar necesitan reintento explícito y pueden consumir más créditos. El paquete no contiene la clave compartida en el chat.

## Prueba con varias personas

1. En Questions, asigna secciones a las preguntas que utilizarás.
2. Persona A escribe su nombre, graba y guarda. Espera el transcript/historia.
3. Desde otro navegador sin historial, abre Recuerdos: debe aparecer el mismo resultado. Prueba abrir el texto y el video con sus permisos correspondientes.
4. Persona B graba la misma pregunta con otro nombre. En Recuerdos pulsa Actualizar lista y filtra por cada persona. Deben ser dos recuerdos independientes.
5. Cambia section de la pregunta en Sheets y actualiza la lista: ambos recuerdos deben pasar a esa sección.
6. Abre index.html de nuevo y espera diez segundos. Debe permanecer el grabador, sin mostrar un resultado anterior.

## Validación y archivos

**55 pruebas locales**: 27 de servidor, 11 de interfaz, 9 de grabación y 8 de páginas compartidas. Incluyen dos navegadores simulados recibiendo la misma lista, filtros por sección/persona, apertura por ID sin token, actualización desde Sheets y desactivación del modo compartido. Se verificaron sintaxis y manifiesto. No se desplegó en tus cuentas ni se llamó a Google/AssemblyAI con tu clave; falta la prueba real tras instalar.

```text
node tests/backend.test.cjs
node tests/frontend.test.cjs
node tests/recording-regression.test.cjs
node tests/shared-pages.test.cjs
```

Archivos web: index.html, memory.html, recuerdos.html, app.js, api.js, library.js, styles.css y config.js. Apps Script: Code.gs y appsscript.json. Incluye README, prompt de referencia y pruebas.
