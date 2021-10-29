# MergePublishSites.

## Simple publicador de sitios usado para obtener y empaquetar la versión actual de un sitio web y correr el publicador en el servidor para colocarlo en su carpeta y hacer un respaldo del sitio anterior.

<br>

### *Pregunta:*
- Si se obtendran los sources desde `svn`.
- Si se desea generar el comprimido ***sitios.7z***
- Si se desea eliminar el web.config para mantener el actual a la hora de publicar.
- Contraseña a usar para el 7z (opcional)

`sitios.json` debe lucir algo similar a esto:
```json
"vars": {
    "borrarwc": true,
    "comprimir": true,
    "obtener": true,
    "net4": "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319",
    "net2": "C:\\Windows\\Microsoft.NET\\Framework\\v2.0.50727",
    "z7":"C:\\7-zip\\7z.exe",
    "pw7": ""
  },
  "sitios": [{
    "clave": "<kv1>",
    "compilar": (true|false),
    "repo": "<ruta svn>",
    "versionNet": 4,
    "folder": "<ruta compilar>"
  },...]
En este archivo se definen las respuestas por defecto asi como variables usadas para encontrar los ejecutables para compilar y comprimir.

invoquese con <kbd>node .</kbd>
y como <kbd>node . -h</kbd> para ver la lista de comandos soportados
