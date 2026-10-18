/**
 * Utilities for parsing and converting educational media links:
 * - Converts any YouTube link into a privacy-friendly https://www.youtube-nocookie.com/embed/... URL
 * - Extracts clean embed URLs from GeoGebra links or pasted <iframe> code with full responsive width & aspect ratio
 * - Extracts clean embed URLs from H5P links or pasted <iframe> code
 */

export function parseYouTubeUrl(input: string): string | null {
  if (!input || !input.trim()) return null;
  const str = input.trim();

  // If iframe is passed, extract src
  const iframeSrcMatch = str.match(/src=["'](.*?)["']/);
  const target = iframeSrcMatch ? iframeSrcMatch[1] : str;

  // Various YouTube patterns:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  let videoId: string | null = null;

  try {
    const url = new URL(target.startsWith('http') ? target : `https://${target}`);
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/watch')) {
        videoId = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.replace('/embed/', '').split('/')[0];
      } else if (url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.replace('/shorts/', '').split('/')[0];
      }
    } else if (url.hostname.includes('youtu.be')) {
      videoId = url.pathname.replace('/', '').split('?')[0];
    }
  } catch (e) {
    // Fallback regex if URL parsing fails
    const match = target.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (match) videoId = match[1];
  }

  if (videoId) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
  }

  // If already nocookie embed
  if (target.includes('youtube-nocookie.com/embed/')) {
    return target;
  }

  return null;
}

export interface GeoGebraParams {
  materialId: string;
  width: number;
  height: number;
}

/**
 * Extracts the material ID, width, and height from any GeoGebra link or <iframe> snippet.
 */
export function extractGeoGebraParams(input: string): GeoGebraParams | null {
  if (!input || !input.trim()) return null;
  const str = input.trim();

  // Check if an iframe was pasted
  const iframeMatch = str.match(/src=["'](.*?)["']/);
  const target = iframeMatch ? iframeMatch[1] : str;

  // Check if width / height were in iframe attributes or URL path
  let width: number | null = null;
  let height: number | null = null;

  const widthAttr = str.match(/\bwidth=["']?(\d+)/i);
  const heightAttr = str.match(/\bheight=["']?(\d+)/i);
  if (widthAttr && widthAttr[1]) width = parseInt(widthAttr[1], 10);
  if (heightAttr && heightAttr[1]) height = parseInt(heightAttr[1], 10);

  const urlWidthMatch = target.match(/\/width\/(\d+)/i);
  const urlHeightMatch = target.match(/\/height\/(\d+)/i);
  if (urlWidthMatch && urlWidthMatch[1]) width = parseInt(urlWidthMatch[1], 10);
  if (urlHeightMatch && urlHeightMatch[1]) height = parseInt(urlHeightMatch[1], 10);

  let materialId: string | null = null;

  try {
    const url = new URL(target.startsWith('http') ? target : `https://${target}`);
    if (url.hostname.includes('geogebra.org')) {
      const path = url.pathname;
      if (path.startsWith('/m/')) {
        materialId = path.replace('/m/', '').split('/')[0];
      } else if (path.startsWith('/classic/')) {
        materialId = path.replace('/classic/', '').split('/')[0];
      } else if (path.startsWith('/calculator/')) {
        materialId = path.replace('/calculator/', '').split('/')[0];
      } else if (path.startsWith('/geometry/')) {
        materialId = path.replace('/geometry/', '').split('/')[0];
      } else if (path.startsWith('/graphing/')) {
        materialId = path.replace('/graphing/', '').split('/')[0];
      } else if (path.startsWith('/3d/')) {
        materialId = path.replace('/3d/', '').split('/')[0];
      } else if (path.includes('/material/iframe/id/')) {
        const parts = path.split('/material/iframe/id/')[1]?.split('/');
        if (parts && parts[0]) {
          materialId = parts[0];
        }
      } else if (path.includes('/material/show/id/')) {
        const parts = path.split('/material/show/id/')[1]?.split('/');
        if (parts && parts[0]) {
          materialId = parts[0];
        }
      }
    }
  } catch (e) {
    // Ignore URL parse error and continue to regex fallback
  }

  // Regex fallback for various formats
  if (!materialId) {
    const match = target.match(
      /(?:geogebra\.org\/(?:m|classic|calculator|geometry|graphing|3d|material\/iframe\/id|material\/show\/id)\/|id\/)([a-zA-Z0-9]+)/i
    );
    if (match && match[1]) {
      materialId = match[1];
    } else {
      // Check if raw alphanumeric 8-char material id was pasted directly
      const rawIdMatch = str.match(/^[a-zA-Z0-9]{6,12}$/);
      if (rawIdMatch) {
        materialId = rawIdMatch[0];
      }
    }
  }

  if (!materialId) return null;

  // Use standard wide 16:10 dimensions (960x600) as default if none specified.
  // This provides ample horizontal canvas space so wide graphs/controls don't get truncated.
  const finalWidth = width && width >= 300 && width <= 2400 ? width : 960;
  const finalHeight = height && height >= 200 && height <= 1600 ? height : 600;

  return {
    materialId,
    width: finalWidth,
    height: finalHeight,
  };
}

/**
 * Returns a fully optimized GeoGebra embed URL ensuring:
 * - Dynamic width/height configured so GeoGebra does not clip the right side or leave dead space
 * - Zoom controls (+/-) enabled (szb=true) so students can zoom in/out
 * - Shift-drag pan & zoom enabled (sdz=true)
 * - Fullscreen button enabled (sfsb=true)
 * - Reset view button enabled (sri=true)
 * - Distracting author menus hidden (smb=false, stb=false)
 */
export function parseGeoGebraUrl(
  input: string,
  customWidth?: number,
  customHeight?: number
): string | null {
  if (!input || !input.trim()) return null;
  const params = extractGeoGebraParams(input);
  if (!params) {
    const str = input.trim();
    // If it's already an iframe or full URL that couldn't be parsed, return sanitized URL
    const iframeMatch = str.match(/src=["'](.*?)["']/);
    const target = iframeMatch ? iframeMatch[1] : str;
    return target.startsWith('http') ? target : `https://${target}`;
  }

  const w = customWidth !== undefined ? customWidth : params.width;
  const h = customHeight !== undefined ? customHeight : params.height;

  return `https://www.geogebra.org/material/iframe/id/${params.materialId}/width/${w}/height/${h}/rc/false/ai/false/sri/true/szb/true/sfsb/true/smb/false/stb/false/stbh/false/ld/false/sdz/true`;
}

/**
 * Returns aspect ratio and dimensions for rendering the container accurately.
 */
export function getGeoGebraDimensions(input: string): {
  width: number;
  height: number;
  aspectRatio: string;
} {
  const params = extractGeoGebraParams(input);
  const width = params?.width || 960;
  const height = params?.height || 600;
  return {
    width,
    height,
    aspectRatio: `${width} / ${height}`,
  };
}

export function parseH5PUrl(input: string): string | null {
  if (!input || !input.trim()) return null;
  const str = input.trim();

  // If iframe code was pasted
  const iframeMatch = str.match(/src=["'](.*?)["']/);
  if (iframeMatch) {
    return iframeMatch[1];
  }

  // If raw URL
  return str.startsWith('http') ? str : `https://${str}`;
}
