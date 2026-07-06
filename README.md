# PixelCurcubeu

Aplicación de gestión de inventario y ventas con React + Vite.

## Estructura

- src/app/App.tsx: vista principal y navegación.
- src/app/types.ts: modelos compartidos de productos, ventas y servicios.
- src/app/services/inventoryService.ts: capa de almacenamiento actual, lista para conectarse a una API o base de datos.
- src/app/components: pantallas y componentes de UI.

## Cambios recientes

- Se separó la lógica de negocio de la interfaz.
- Se creó una capa de servicio para persistencia local.
- La app está preparada para cambiar este servicio por una implementación basada en API o base de datos.

## Próximo paso para conectar a una base de datos

1. Sustituir LocalInventoryService por un servicio que haga peticiones HTTP.
2. Exponer endpoints como:
   - GET /products
   - POST /products
   - PUT /products/:id
   - DELETE /products/:id
   - GET /sales
   - POST /sales
3. Adaptar la interfaz para consumir esos datos desde la API.
