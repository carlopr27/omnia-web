# Memora / Remento · MVP 0.2B

**Video → Drive → transcripción → título e historia autobiográfica → Sheets y página del recuerdo.**

Este paquete extiende los archivos del MVP 0.2A entregado en este chat. Conserva el grabador, revisión local, Base64 validado, preguntas desde Sheets, máximo de tres minutos, polling y proceso en segundo plano. Añade AssemblyAI LLM Gateway con **`qwen3.5-4b-32k-fast`**, el modelo del ejemplo oficial que compartiste. No hay otro proveedor de IA ni cambio de hosting.

## Actualizar tu instalación 0.2A

1. Haz una copia de tu Sheet y de Code.gs por si quieres regresar a 0.2A.
2. Mantén el mismo proyecto de Apps Script y sus Script Properties:

   | Propiedad | Valor |
   | --- | --- |
   | `APP_ORIGIN` | **`https://omniaex.com`** |
   | `ASSEMBLYAI_API_KEY` | Tu nueva clave válida, guardada solo aquí. |
   | `SPREADSHEET_ID` | ID del Sheet que ya usas en 0.2A. |
   | `DRIVE_FOLDER_ID` | ID de la carpeta de videos que ya usas. |

   No uses `https://github.com/...` ni `/mem/index.html` como APP_ORIGIN. Si tu sitio redirige a www, usa el origen exacto de la dirección final. La clave compartida anteriormente debe revocarse; no la hemos incorporado al paquete.

3. Reemplaza **Code.gs** por `apps-script/Code.gs`. Mantén o copia `apps-script/appsscript.json`; los permisos son los mismos que en 0.2A.
4. Ejecuta **setupMvp** manualmente. No borra ni reemplaza los videos, preguntas o propiedades existentes. Añade columnas de historia a **Videos**, crea **Prompts** con STORY_V1 y conserva el activador `processPending` de cada minuto. Ejecutarlo de nuevo no duplica el prompt ni el activador, ni reemplaza tus cambios de prompt.
5. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**. Conserva ejecutar como Yo y acceso Cualquier persona. Si editas la misma implementación, la URL `/exec` sigue siendo la misma.
6. En el paquete, pega **tu URL `/exec` existente** en `config.js`. No subas el archivo con el marcador `PEGA_AQUI_TU_URL_EXEC`.
7. Sustituye en la carpeta **`mem/`** de tu repositorio `omnia-web` estos cuatro archivos: **index.html, app.js, styles.css y config.js**. Publica el commit y espera a que GitHub Pages actualice el sitio.
8. Abre **https://omniaex.com/mem/index.html** y recarga sin caché. El encabezado debe mostrar MVP 0.2B.
9. Graba una respuesta nueva de 15–30 segundos. Primero debe aparecer la transcripción; después, un título y una historia debajo del video.

Los archivos de Apps Script y las pruebas no necesitan subirse a la carpeta pública. No hay instalación de paquetes ni proceso de compilación.

## Prompt editable en Sheets

La pestaña **Prompts** tiene estos campos:

| Campo | Valor inicial | Qué controla |
| --- | --- | --- |
| `prompt_id` | `STORY_V1` | Identificador de la versión editorial |
| `name` | Historia autobiográfica | Nombre descriptivo |
| `active` | TRUE | Activa exactamente una fila |
| `model` | `qwen3.5-4b-32k-fast` | Modelo que recibirá la solicitud |
| `max_tokens` | 1800 | Presupuesto máximo de salida; admite 400–3000 |
| `temperature` | 0.2 | Variación de la respuesta; admite 0–1 |
| `prompt` | Texto editorial incluido | Cómo debe transformar la transcripción |

Para cambiar el estilo, edita la celda **prompt**. Mantén estas dos variables con sus espacios:

```text
{{ question }}
{{ transcript }}
```

Apps Script sustituye **ambas** usando la pregunta y la transcripción guardadas. En este paquete enviamos el texto de Sheets directamente al LLM; no usamos inyección remota de transcript_id. El transcript_id sigue guardado para trazabilidad.

El prompt inicial pide primera persona, idioma original, párrafos naturales, conservar detalles y dudas, eliminar muletillas y evitar hechos inventados. Apunta a 150–350 palabras cuando hay suficiente material, sin expandir artificialmente una grabación breve. La salida requerida es:

```json
{"title":"Título fiel al recuerdo","story":"Historia en primera persona..."}
```

El código añade un contrato fijo de salida y de uso de la transcripción. Puedes modificar las reglas editoriales; conserva title y story. Un modelo puede equivocarse aun con estas instrucciones: revisa la historia con el video y el transcript antes de reutilizarla.

Si quieres probar STORY_V2, duplica la fila, cambia prompt_id y el prompt, y desactiva STORY_V1. Debe quedar exactamente una fila activa. **No necesitas desplegar nuevamente para editar Prompts.** El cambio se aplica a las historias que empiecen después o a un reintento explícito. No reescribe historias ya listas.

Cada intento guarda una copia del template en **prompt_snapshot**, junto con prompt_id, modelo, max_tokens y temperature. Así, editar el prompt mientras se procesa un recuerdo no cambia ese intento.

## Modelo, acceso y créditos

El modelo predeterminado del paquete es **qwen3.5-4b-32k-fast**, elegido por el ejemplo de integración que compartiste; no afirmamos que sea un modelo predeterminado de todos los planes de AssemblyAI. Si `model` está vacío, usa ese mismo modelo. No se configura fallback a otros modelos.

La [hoja de ruta oficial](https://www.assemblyai.com/roadmap) anuncia acceso de cuentas gratuitas a LLM Gateway desde el 18 de agosto de 2026. Su [Quickstart](https://www.assemblyai.com/docs/llm-gateway/quickstart) utiliza este modelo y endpoint. Algunas páginas de soporte aún indican que el plan gratuito no incluye Gateway. Estas fuentes no permiten asegurar que los $50 iniciales sean un saldo intercambiable entre audio y LLM en tu cuenta.

La prueba real de tu cuenta decidirá si la solicitud se acepta. Revisa el uso y saldo en el panel después del primer video. Este paquete no modifica tu plan, no agrega tarjeta y no recarga saldo. Si la cuenta devuelve un error de acceso/saldo/modelo, se conserva el video y transcript y se muestra el error de historia. El acceso de prueba no implica uso ilimitado gratuito.

## Estados: dos trabajos independientes

**status** conserva el significado de 0.2A:

| Estado | Significado |
| --- | --- |
| VIDEO_SAVED | Archivo y fila guardados |
| TRANSCRIBING | AssemblyAI aceptó la transcripción; hay transcript_id |
| READY | Transcripción final guardada |
| ERROR | Falló la transcripción |

**story_status** añade el estado del segundo trabajo:

| Estado | Significado |
| --- | --- |
| PENDING | Historia solicitada; esperando transcript/configuración |
| GENERATING | Prompt preparado o llamada al LLM en curso |
| READY | Título e historia guardados |
| ERROR | Falló la historia; el transcript sigue disponible |
| SKIPPED | Transcript vacío; no se llama al LLM |
| NOT_REQUESTED | Recuerdo antiguo de 0.2A sin historia solicitada |

El front continúa consultando cada cinco segundos después de cada respuesta, sin solicitudes simultáneas. Se detiene cuando ambos trabajos terminaron o necesitan una acción. **status READY por sí solo no significa que la historia terminó.** El proceso de Apps Script continúa cada minuto si cierras la página. El panel muestra el video, la historia y la transcripción original por separado.

## Recuerdos anteriores y reintentos

- Los nuevos videos 0.2B solicitan historia automáticamente.
- Actualizar el proyecto no envía todos los videos anteriores al LLM. Si el navegador conserva el último recuerdo de 0.2A, al abrirlo verás **Crear historia de este recuerdo**. Ese botón reutiliza su transcript; no vuelve a subir ni transcribir el video.
- **Reintentar historia** aparece ante un fallo del LLM y usa el prompt actualmente activo. No regraba, no vuelve a transcribir y no elimina el video.
- Solicitudes repetidas de crear/reintentar durante GENERATING o después de READY no crean otra llamada.
- HTTP 429 se reintenta con espera de 30 y 60 segundos, hasta tres intentos en total. No cambia el modelo. Si persiste, aparece ERROR.
- Errores de red, HTTP 5xx, respuesta incompleta o JSON inválido requieren reintento explícito. Si una llamada quedó sin confirmar, revisa el uso de AssemblyAI: podría haberse procesado y un nuevo intento podría consumir más créditos.
- No hay botón para regenerar una historia ya exitosa ni biblioteca de recuerdos en esta versión. **Grabar otro recuerdo** inicia un video nuevo, conserva las filas/archivos anteriores y reemplaza el acceso local al último recuerdo.

## Qué se guarda

Se conserva **Videos** de 0.2A y se añaden: story_status, story_title, story_text, story_error, prompt_id, prompt_snapshot, llm_model, llm_max_tokens, llm_temperature, llm_request_id, llm_response_id, llm_input_tokens, llm_output_tokens, story_requested_at, story_started_at, story_completed_at, story_attempts y story_next_attempt_at. Los IDs del proveedor y tokens se guardan cuando el proveedor los devuelve.

No cambies los encabezados de Videos. El Sheet y su columna access_token no deben publicarse. El front recibe solo los campos necesarios; no recibe la API key ni el template editorial. Preguntas mantienen `id`, `question`, `active`, `featured`, `sortOrder`, con active TRUE para aparecer en la web.

## Implementación y límites

Apps Script llama a `https://llm-gateway.assemblyai.com/v1/chat/completions` con authorization tomada de Script Properties. Utiliza chat completions normal, como el ejemplo compartido. **No fuerza json_schema**, porque no asumimos que esa modalidad esté habilitada para esta variante exacta de Qwen en tu cuenta. Pide JSON por prompt y valida el objeto en el servidor: exactamente title y story, texto no vacío, hasta 250 caracteres de título y 20000 de historia. Se tolera un único bloque Markdown JSON exterior. Una respuesta cortada por max_tokens o inválida no se publica como historia lista.

La interfaz inserta las respuestas con textContent, no como HTML. El puente POST/iframe/postMessage, el nombre de archivo determinista y la validación de Base64/bytes son los de 0.2A. Se conserva el identificador local `memora02a` y el protocolo `memora-02a` para compatibilidad; esos nombres internos no indican la versión visible.

Los videos no se hacen públicos automáticamente. AssemblyAI recibe sus bytes desde Apps Script. Para reproducir desde Drive, usa una cuenta con permiso; si el iframe pide acceso, pulsa Abrir video en Drive o comparte el archivo con la cuenta de prueba desde Drive.

El endpoint de Apps Script es público para este MVP. APP_ORIGIN controla la respuesta al sitio pero no sustituye autenticación ni protección contra abuso. Se mantiene el alcance de pruebas controladas de 0.2A. No hay cuentas, pagos, invitaciones o publicación de historias para terceros.

Los bitrates y resolución son solicitudes al navegador, y los límites de tiempo/memoria/cuotas de Google siguen aplicando. El grabador se detiene a 180 segundos; Apps Script valida la duración declarada. La migración no altera esa parte.

## Comprobación tras instalar

1. Confirma que aparece 0.2B y que las preguntas del Sheet siguen cargando.
2. Graba 15–30 segundos con un recuerdo concreto en español. Revisa audio y video localmente y guarda.
3. Confirma el archivo en Drive, transcript_id y transcript en Videos.
4. Confirma story_status GENERATING y después READY; compara story_title/story_text en Sheets y en la página.
5. Revisa que la historia conserva los hechos, el idioma y la primera persona. Mira también el consumo en AssemblyAI.
6. Edita el prompt en Prompts y graba otro video para comparar. La historia previa debe permanecer igual.
7. Recarga durante la generación. Cierra la página y comprueba más tarde que el activador guardó el resultado.
8. Si aparece ERROR de historia, corrige acceso/saldo/configuración y usa Reintentar historia. Verifica que no se crea otro archivo ni transcript_id.
9. Comprueba finalmente el límite de tres minutos en tu dispositivo.

**Validación del paquete:** pruebas locales con servicios simulados y revisión de sintaxis. No hemos ejecutado llamadas reales usando tu clave, ni publicado cambios en GitHub/Apps Script. La calidad editorial, acceso, saldo y respuesta real del modelo se verifican con tu primera grabación tras instalarlo.

Para ejecutar las pruebas localmente, si tienes Node:

```text
node tests/backend.test.cjs
node tests/frontend.test.cjs
```

## Archivos del paquete

- index.html, styles.css, app.js y config.js: web estática.
- apps-script/Code.gs y apps-script/appsscript.json: servidor y permisos.
- PROMPT-STORY-V1.txt: copia del prompt inicial para leerlo/editarlo; el sistema usa la celda Prompts, no este archivo.
- README.md y tests/: instrucciones y pruebas locales.

Referencias: [Quickstart LLM Gateway](https://www.assemblyai.com/docs/llm-gateway/quickstart), [roadmap con acceso gratuito](https://www.assemblyai.com/roadmap), [Content/HTML Service de Google](https://developers.google.com/apps-script/guides/html/restrictions).
