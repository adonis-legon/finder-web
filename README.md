# Buscador de Objetos (v0.1)

Juego web para acompañar libros físicos de tipo "busca y encuentra". Muestra las escenas
de cada libro con su lista de objetos, permite marcar los encontrados y guarda el progreso
por jugador en el navegador (localStorage). Sin backend ni credenciales.

Soporta **múltiples libros**, cada uno con su propio **look & feel** (colores/tema), y
presenta las escenas en modo **wizard** (una por pantalla, con avanzar/retroceder).

## Flujo

1. **Elegí un libro** — cada libro aplica su propio tema de colores.
2. **Elegí (o creá) un jugador** — el progreso es por libro + jugador.
3. **Jugá** — navegá escena por escena marcando los objetos encontrados.

## Archivos

- `index.html` — estructura (pantallas de libros, jugador y juego).
- `styles.css` — estilos basados en variables CSS (el tema se cambia en caliente).
- `app.js` — lógica: catálogo, temas, jugadores, progreso y wizard.
- `books.json` — **catálogo de libros**: nombre, subtítulo, tema y archivo de escenas.
- `data-harry-potter.json` — escenas del libro.
- `README.md` — este archivo.

## Cómo ejecutarlo

La app carga JSON con `fetch`, así que **no** funciona abriendo `index.html` con doble clic
(protocolo `file://`). Necesitás un servidor local:

```bash
cd finder
python3 -m http.server 8000
# abrí http://localhost:8000
```

## Cómo agregar un libro

1. Creá un archivo `data-<id>.json` con las escenas:

   ```json
   {
     "scenes": [
       {
         "id": "escena-1",
         "name": "Nombre de la escena",
         "description": "Texto opcional",
         "items": ["Objeto 1", "Objeto 2"]
       }
     ]
   }
   ```

2. Agregá una entrada en `books.json` dentro de `books`:

   ```json
   {
     "id": "mi-libro",
     "name": "Mi Libro",
     "subtitle": "Un subtítulo",
     "dataFile": "data-mi-libro.json",
     "theme": {
       "--accent": "#d4af37",
       "--accent-soft": "#e8cf7a",
       "--bg-dark": "#0e1a2b",
       "--bg-panel": "#16263f",
       "--bg-panel-light": "#1f3557",
       "--text": "#f2efe6",
       "--text-dim": "#a9b6c9",
       "--green": "#4caf50",
       "--red": "#c0392b",
       "--border-color": "#2c456b",
       "--bg-gradient-from": "#1a2c47",
       "--bg-gradient-to": "#0e1a2b"
     }
   }
   ```

   El `theme` sobrescribe las variables CSS al entrar al libro. Podés definir solo las que
   quieras cambiar; el resto usa los valores por defecto de `:root` en `styles.css`.

3. (Opcional) Agregá un ícono para el libro en el objeto `BOOK_ICONS` de `app.js`.

## Notas

- El `id` de cada libro y de cada escena no debería cambiar una vez que hay progreso
  guardado (el progreso se referencia por esos `id`).
- El progreso se guarda por dispositivo/navegador.
- Navegación del wizard: botones anterior/siguiente, los puntos (dots) inferiores, o las
  flechas ‹ › del teclado. Los puntos se ponen verdes cuando la escena está completa.

## Ideas para próximas versiones

- Mostrar la imagen de cada escena.
- Exportar/importar progreso entre dispositivos.
- Efecto de sonido o animación al completar una escena o un libro.
