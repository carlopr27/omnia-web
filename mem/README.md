# Memora / Remento · MVP 0.2A

Grabar video y audio → revisar → guardar en Drive → AssemblyAI → transcripción literal en Sheets y debajo del video. GitHub Pages + Google Apps Script + Drive/Sheets. Sin LLM, prompts ni generación de historias.

Este paquete reconstruye el comportamiento documentado del MVP 0.1: el ZIP antiguo del chat no estuvo disponible para comparar sus archivos. Conserva preguntas de Sheets, revisión local, Base64 con validación de bytes, 640 × 360 / 24 fps solicitados, 400 kbps de video, 48 kbps de audio y máximo 180 segundos. No es un parche sobre los archivos originales. Haz copia de tu proyecto y del Sheet antes de reemplazarlos.

## Instalación

1. En el proyecto existente de Apps Script, abre **Configuración del proyecto → Propiedades de la secuencia de comandos** y añade:

   | Propiedad | Valor |
   | --- | --- |
   | `ASSEMBLYAI_API_KEY` | Tu clave real de AssemblyAI. Solo aquí. |
   | `APP_ORIGIN` | Origen exacto de GitHub Pages, por ejemplo `https://aldo.github.io` (sin ruta ni `/` final). |
   | `SPREADSHEET_ID` | ID de tu Sheet 0.1 existente, tomado de `/spreadsheets/d/ID/edit`. |
   | `DRIVE_FOLDER_ID` | ID de tu carpeta de videos existente, tomado de `/folders/ID`. |

   Si quieres una instalación limpia, omite únicamente los dos IDs; `setupMvp` creará recursos nuevos. Si las propiedades de 0.1 tienen otros nombres, copia sus valores a los nombres anteriores. No pegues ninguna clave en GitHub, config.js, README ni capturas públicas.

2. Reemplaza `Code.gs` por `apps-script/Code.gs`. Activa **Mostrar archivo de manifiesto appsscript.json** en configuración y copia también el manifiesto incluido. Ejecuta `setupMvp` manualmente y autoriza Drive, Sheets, conexiones externas y el activador.
3. `setupMvp` conserva las filas, añade columnas faltantes a **Videos**, conserva **Questions** y crea un activador de `processPending` cada minuto. Puedes ejecutarlo de nuevo sin duplicar el activador. Mira el registro de ejecución para abrir el Sheet y la carpeta. Usa la misma cuenta propietaria de ambos recursos.
4. **Implementar → Administrar implementaciones → Editar → Nueva versión**, tipo **Aplicación web**, ejecutar como **Yo**, acceso **Cualquier persona**. También puedes crear una implementación nueva. Copia la URL terminada en `/exec`, no `/dev`. Algunas cuentas Workspace bloquean acceso anónimo; necesitarás que esté permitido para este MVP.
5. Pega la URL en `config.js`, propiedad `API_URL`. Mantén `MAX_RECORDING_SECONDS: 180`.
6. Sube `index.html`, `styles.css`, `app.js` y `config.js` a la raíz publicada de tu repositorio. En **Settings → Pages**, publica la rama/carpeta correspondiente y espera a que termine. Los archivos de Apps Script no necesitan publicarse en Pages. No hay dependencias ni proceso de compilación.
7. Abre el sitio HTTPS, permite cámara y micrófono y prueba una grabación nueva de 10–20 segundos. Las grabaciones 0.1 anteriores no se envían automáticamente.

## Preguntas desde Sheets

Pestaña **Questions**, encabezados exactos: `id`, `question`, `active`, `featured`, `sortOrder`.

Ejemplo: `Q001 | ¿Cuál es tu primer recuerdo? | TRUE | TRUE | 1`.

Solo aparecen preguntas activas. Featured va primero y después sortOrder. Otra pregunta recorre la lista. Recarga la página tras editar Sheets; no necesitas volver a desplegar. La pregunta queda bloqueada durante grabación/revisión para no asignar el video a otra pregunta.

## Estados y datos

- `VIDEO_SAVED`: el archivo existe en Drive y la fila se guardó en Videos.
- `TRANSCRIBING`: AssemblyAI aceptó el trabajo; `transcript_id` ya está guardado.
- `READY`: la transcripción literal se guardó en `transcript` y aparece debajo del video.
- `ERROR`: fallo definitivo o solicitud de transcripción sin confirmar; se conserva el video y se muestra el error.

Videos añade `memory_id`, `question_id`, `question`, `drive_file_id`, `video_url`, `created_at`, `duration_seconds`, `byte_length`, `mime_type`, `status`, `transcript_id`, `transcript`, `error`, `access_token`, `updated_at`, `assembly_upload_url`, `last_checked_at`, `submit_started_at`. Las columnas antiguas se conservan; las filas nuevas rellenan estos encabezados. No cambies sus nombres. `access_token` permite consultar ese recuerdo; no publiques el Sheet.

El servidor lee el Blob de Drive, sube sus bytes mediante `POST /v2/upload`, solicita `POST /v2/transcript` y consulta `GET /v2/transcript/{id}`. Usa detección de idioma y `speech_models: ["universal-3-pro", "universal-2"]`. El front consulta Apps Script cinco segundos después de cada respuesta (sin consultas superpuestas). Un activador cada minuto permite avanzar al cerrar la página. READY puede contener texto vacío si no se detectó habla; se muestra un mensaje explícito.

El último identificador y su token quedan en localStorage de ese navegador para recuperar el estado al recargar. **Grabar otro recuerdo** elimina ese acceso local, aunque el archivo y la fila siguen en Drive/Sheets. No se añade biblioteca ni enlaces familiares en esta versión.

## Comunicación GitHub Pages ↔ Apps Script

Se usa POST de formulario a un iframe oculto y una respuesta `postMessage`, porque Apps Script no ofrece configuración libre de cabeceras CORS. El campo `payload` contiene JSON y Base64 estándar; la codificación normal del formulario preserva `+`, `/` y `=` y Apps Script obtiene el JSON ya decodificado. Se valida Base64 y se compara el número de bytes antes de crear el archivo. No se usa `fetch` con `no-cors` ni se interpreta una respuesta opaca como éxito.

El puente verifica origen de Google, identificador aleatorio de solicitud y APP_ORIGIN como destino de la respuesta. APP_ORIGIN no es autenticación: el endpoint sigue siendo público y se puede llamar fuera de un navegador. Este MVP es para pruebas controladas; no incluye cuentas, control de abuso ni permisos entre usuarios. La API key permanece en el servidor y nunca se devuelve al front.

## Video y permisos de Drive

No se publican automáticamente los videos. AssemblyAI recibe los bytes desde Apps Script y no necesita un enlace público. Para ver el reproductor de Drive entra en la cuenta con permiso sobre el archivo. Si el iframe pide acceso o el navegador bloquea cookies, usa **Abrir video en Drive**. Para pruebas desde otra cuenta, comparte el archivo/carpeta con esa cuenta desde Drive. Solo si lo deseas, puedes cambiar manualmente un archivo a “Cualquier persona con el enlace”; eso permite a cualquiera con ese enlace ver el video.

## Reintentos y diagnóstico

- Si no llega la respuesta de subida, consulta de nuevo o pulsa Guardar otra vez. El mismo `memory_id` y nombre determinista de archivo evitan duplicar la subida en un reintento. No pulses Grabar otro recuerdo antes de comprobar el resultado.
- Fallos temporales HTTP 429/5xx al subir o consultar conservan el estado para otro intento. Un fallo de envío del trabajo que queda sin confirmar pasa a ERROR; revisa el panel AssemblyAI antes de pulsar Reintentar, porque ese reintento explícito podría crear otro trabajo facturable si el anterior sí fue aceptado.
- Reintentar reutiliza un transcript_id existente si el trabajo sigue pendiente o ya terminó; solo solicita uno nuevo si el trabajo falló o no hay ID confirmado. No elimina el video.
- Si falta la key o devuelve HTTP 401, revisa Script Properties. Si hay HTTP 400, saldo insuficiente o un modelo no disponible, revisa tu cuenta y los modelos vigentes en AssemblyAI. No se realiza reintento infinito de errores definitivos.
- Si no carga ninguna pregunta, confirma APP_ORIGIN exacto, URL /exec y acceso Cualquier persona, y vuelve a implementar una nueva versión. Revisa **Ejecuciones** en Apps Script.
- Si se cierra la página y no progresa, comprueba que el activador processPending esté habilitado. Se procesa una cola pequeña bajo bloqueo para evitar dos solicitudes simultáneas del mismo recuerdo.
- Duración/bitrate dependen del navegador: se detiene automáticamente a 180 segundos, con tolerancia de los temporizadores del dispositivo. Apps Script valida la duración declarada; no analiza el contenedor para verificarla. Los límites de Google, tamaño efectivo de la grabación, memoria y tiempo de ejecución pueden afectar videos grandes. No se impone otro límite de MB en la interfaz. Prueba 10 s, 30 s, 1 min y 3 min en tus dispositivos.

## Verificación

`node tests/backend.test.cjs` ejecuta pruebas locales con servicios simulados: guardado, Base64/bytes, estados, autorización, reintentos y errores. No llama a Google ni AssemblyAI y no requiere una clave.

Prueba real después de instalar:

1. Graba un video con una frase en español; comprueba imagen y audio en la revisión.
2. Guarda; confirma el archivo reproducible en Drive y la fila VIDEO_SAVED.
3. Espera TRANSCRIBING y confirma transcript_id en Videos.
4. Espera READY y compara transcript en Sheets y en la página con lo que dijiste.
5. Recarga mientras está procesando; comprueba que recupera el mismo recuerdo. Cierra la página y revisa después que el activador guardó el resultado.
6. Usa temporalmente una key inválida: el video debe conservarse y aparecer ERROR. Restaura la key y reintenta sin duplicar el archivo.
7. Edita una pregunta y recarga. Finalmente prueba que una grabación se detiene a los tres minutos.

**Validación disponible:** pruebas automatizadas con servicios simulados y revisión de sintaxis. No se ha ejecutado una subida/transcripción real ni una prueba del puente entre dominios en tus cuentas; ese paso requiere instalar y grabar un video nuevo.

## Referencias oficiales

- [AssemblyAI: subir un archivo](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/files/upload)
- [AssemblyAI: solicitar transcripción](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/submit)
- [Google: aplicaciones web](https://developers.google.com/apps-script/guides/web)
- [Google: HtmlService y sandbox](https://developers.google.com/apps-script/guides/html/restrictions)

Archivos: cuatro archivos estáticos de la web, apps-script/Code.gs, apps-script/appsscript.json, este README y tests/backend.test.cjs.
