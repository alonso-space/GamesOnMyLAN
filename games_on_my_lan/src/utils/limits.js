// Límites de subida compartidos (middleware, servicios y validaciones)

export const BYTES_PER_MB = 1024 * 1024;
export const MAX_GAME_BYTES = 1024 * BYTES_PER_MB; // .zip de un juego: 1 GB
export const MAX_IMAGE_BYTES = BYTES_PER_MB; // miniaturas y avatares: 1 MB
export const MAX_IMAGE_DIMENSION = 1024; // píxeles por lado (evita PNG "bomba")
