// Límites de subida compartidos (middleware, servicios y validaciones)

export const MAX_GAME_BYTES = 1024 * 1024 * 1024; // .zip de un juego: 1 GB
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // miniaturas y avatares: 1 MB
export const MAX_IMAGE_DIMENSION = 1024; // píxeles por lado (evita PNG "bomba")
