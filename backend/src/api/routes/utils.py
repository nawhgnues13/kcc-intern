from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import httpx
import mimetypes
from urllib.parse import unquote

router = APIRouter(prefix="/api/utils", tags=["utils"])

@router.get("/download-image")
async def download_image_proxy(
    url: str = Query(..., description="The absolute URL of the image to download"),
    download: bool = Query(False, description="Set true to force attachment download."),
):
    """
    Proxy endpoint to download images from cross-origin sources (like S3) 
    that don't have proper CORS headers for direct browser downloading.
    """
    decoded_url = unquote(url)
    
    # Basic validation
    if not decoded_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL format. Must be absolute http/https URL.")

    try:
        async with httpx.AsyncClient() as client:
            # Fetch the image from the remote server (S3)
            # Backend-to-backend requests are not subject to browser CORS
            response = await client.get(decoded_url, follow_redirects=True, timeout=10.0)
            response.raise_for_status()
            
            # Determine content type and filename
            content_type = response.headers.get("Content-Type", "image/png")
            # Try to guess extension from content-type
            ext = mimetypes.guess_extension(content_type) or ".png"
            
            # Use a generic filename or try to extract from URL
            filename = "downloaded_image" + ext
            try:
                url_path = decoded_url.split("?")[0]
                potential_filename = url_path.split("/")[-1]
                if "." in potential_filename and len(potential_filename) > 4:
                    filename = potential_filename
            except Exception:
                pass

            # Stream the response back to client with attachment header
            headers = {"Access-Control-Expose-Headers": "Content-Disposition"}
            if download:
                headers["Content-Disposition"] = f'attachment; filename="{filename}"'

            return StreamingResponse(
                content=response.iter_bytes(),
                media_type=content_type,
                headers=headers,
            )
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Remote server returned error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal proxy error: {str(e)}")
