"""Avatar upload limits and supported image formats."""

MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_MIME_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}
