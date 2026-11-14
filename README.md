# S08 | AP6 — Exposición de servicios y configuración segura en Minikube

Sistema de Gestión de Productos Agrícolas: API REST (Node.js + Express) con MongoDB desplegada en Minikube.
Demuestra **Namespace, ConfigMap, Secret, Deployment, Service ClusterIP y Service NodePort**.

## Arquitectura

```
 Navegador / curl
       │  http://<IP-Minikube>:30080   (NodePort)
       ▼
┌────────────────────── Namespace: practica-s08 ──────────────────────┐
│  backend-service (NodePort 30080 → 3000)                            │
│        ▼                                                            │
│  backend-deployment  (Node.js + Express, imagen agro-backend:1.0)   │
│     envFrom: ConfigMap app-configmap  (DB_HOST, DB_NAME, APP_PORT)  │
│     envFrom: Secret    db-secret      (DB_USER, DB_PASS)            │
│        ▼  DNS interno: mongo-service:27017                          │
│  mongo-service (ClusterIP, solo interno)                            │
│        ▼                                                            │
│  mongo-deployment (mongo:7.0) ── PVC mongo-pvc (1Gi)                │
└─────────────────────────────────────────────────────────────────────┘
```

## Estructura

```
k8s/
├── 00-namespace.yaml        Namespace practica-s08
├── 01-app-configmap.yaml    Variables no sensibles
├── 02-db-secret.yaml        Credenciales (Opaque, Base64)
├── 03-mongo-stack.yaml      PVC + Deployment + Service ClusterIP
└── 04-backend-stack.yaml    Deployment + Service NodePort
src/                         Código del backend (config/, models/, controllers/, routes/, Dockerfile)
docs/informe-tecnico.md      Contenido del informe para Google Docs
```

## Requisitos previos

Docker Desktop en ejecución, Minikube, kubectl y (opcional, solo para ejecutar sin contenedor) Node.js 20+.

## Configuración de variables

| Variable | Origen | Valor |
|---|---|---|
| `DB_HOST` | ConfigMap | `mongo-service` |
| `DB_NAME` | ConfigMap | `agro_productos` |
| `APP_PORT` | ConfigMap | `3000` |
| `DB_USER` | Secret | credencial de laboratorio (Base64) |
| `DB_PASS` | Secret | credencial de laboratorio (Base64) |

El backend construye `mongodb://DB_USER:DB_PASS@DB_HOST:27017/DB_NAME?authSource=admin`
([src/config/database.js](src/config/database.js)). MongoDB crea su usuario administrador con las mismas
claves del Secret (`MONGO_INITDB_ROOT_*`).

### Generar credenciales de laboratorio (Base64)

```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('mi_usuario'))
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('mi_password'))
```
```bash
echo -n 'mi_usuario' | base64
```

> **Base64 no es cifrado**: es solo una codificación reversible. Los valores incluidos en este repositorio
> son credenciales de laboratorio sin ningún uso real. Nunca versiones credenciales reales; en producción usa
> Sealed Secrets, External Secrets o Vault. Si cambias las credenciales **después** de crear el volumen de
> MongoDB, borra el PVC (`kubectl delete pvc mongo-pvc -n practica-s08`), porque el usuario root solo se crea
> al inicializar un volumen vacío.

## Despliegue (PowerShell)

```powershell
# 1. Herramientas y clúster
docker --version; kubectl version --client; minikube start --driver=docker; minikube status

# 2. Construir la imagen y cargarla en Minikube (el clúster no ve las imágenes locales de Docker)
docker build -t agro-backend:1.0 ./src
minikube image load agro-backend:1.0

# 3. Aplicar manifiestos en orden
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-app-configmap.yaml
kubectl apply -f k8s/02-db-secret.yaml
kubectl apply -f k8s/03-mongo-stack.yaml
kubectl apply -f k8s/04-backend-stack.yaml

# 4. Esperar a que estén listos
kubectl rollout status deployment/mongo-deployment -n practica-s08
kubectl rollout status deployment/backend-deployment -n practica-s08
```

El backend reintenta la conexión mientras MongoDB arranca; verás algunos `ECONNREFUSED` iniciales en sus logs, es normal.

## Verificación

```powershell
kubectl get pods,svc,configmaps,secrets -n practica-s08

$pod = kubectl get pod -n practica-s08 -l app=backend -o jsonpath='{.items[0].metadata.name}'
kubectl exec -it $pod -n practica-s08 -- env          # muestra ConfigMap + Secret inyectados
# Sin imprimir la contraseña:
kubectl exec $pod -n practica-s08 -- env | Select-String '^(DB_|APP_PORT)' | ForEach-Object { $_ -replace '^(DB_PASS=).*','$1********' }

kubectl exec $pod -n practica-s08 -- wget -qO- http://localhost:3000/db-status   # ping autenticado a MongoDB
kubectl get svc mongo-service -n practica-s08          # TYPE debe ser ClusterIP
```

## Acceso al backend (NodePort)

```powershell
minikube service backend-service -n practica-s08 --url
```

Con el driver Docker en Windows, Minikube abre un túnel y muestra una URL `http://127.0.0.1:<puerto>`;
**deja esa terminal abierta** mientras uses la URL. (Con otros drivers la URL es `http://<minikube ip>:30080`).

## Endpoints

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| GET | `/` | Índice del servicio | 200 |
| GET | `/health` | Salud del backend | 200 |
| GET | `/db-status` | Ping autenticado a MongoDB | 200 / 503 |
| POST | `/api/productos` | Registrar producto | 201 / 400 |
| GET | `/api/productos` | Listar productos | 200 |
| GET | `/api/productos/:id` | Buscar por ID | 200 / 400 / 404 |
| PUT | `/api/productos/:id` | Actualizar producto | 200 / 400 / 404 |
| DELETE | `/api/productos/:id` | Eliminar producto | 200 / 400 / 404 |

Campos: `nombre`, `categoria`, `cantidadDisponible` (≥ 0), `unidadMedida`, `estado` (`disponible` | `agotado` | `en_cosecha`).
Al primer arranque, si la colección está vacía, se cargan Mandarina, Palta Hass, Arándano y Caqui.

```powershell
$u = "<URL de minikube service>"
Invoke-RestMethod "$u/api/productos"
Invoke-RestMethod "$u/api/productos" -Method Post -ContentType 'application/json' `
  -Body '{"nombre":"Uva Red Globe","categoria":"Frutas","cantidadDisponible":300,"unidadMedida":"kg","estado":"en_cosecha"}'
```

## Eliminar el laboratorio

```powershell
kubectl delete namespace practica-s08     # borra todos los recursos, incluido el PVC
minikube image rm agro-backend:1.0        # opcional
minikube stop                             # opcional
```
