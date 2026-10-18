/**
 * Utilities for parsing and converting educational media links:
 * - Converts any YouTube link into a privacy-friendly https://www.youtube-nocookie.com/embed/... URL
 * - Extracts clean embed URLs from GeoGebra links or pasted <iframe> code
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

export function parseGeoGebraUrl(input: string): string | null {
  if (!input || !input.trim()) return null;
  const str = input.trim();

  // If iframe snippet was pasted: <iframe ... src="...
  const iframeMatch = str.match(/src=["'](.*?)["']/);
  const target = iframeMatch ? iframeMatch[1] : str;

  // Patterns:
  // - https://www.geogebra.org/m/abc12345
  // - https://www.geogebra.org/classic/abc12345
  // - https://www.geogebra.org/material/iframe/id/abc12345/...
  try {
    const url = new URL(target.startsWith('http') ? target : `https://${target}`);
    if (url.hostname.includes('geogebra.org')) {
      let materialId: string | null = null;
      if (url.pathname.startsWith('/m/')) {
        materialId = url.pathname.replace('/m/', '').split('/')[0];
      } else if (url.pathname.startsWith('/classic/')) {
        materialId = url.pathname.replace('/classic/', '').split('/')[0];
      } else if (url.pathname.includes('/material/iframe/id/')) {
        const parts = url.pathname.split('/material/iframe/id/')[1]?.split('/');
        if (parts && parts[0]) {
          materialId = parts[0];
        }
      }

      if (materialId) {
        // sri=true (Scale Ratio Invert) makes GeoGebra scale dynamically to fill the container without white letterbox void.
        // sfsb=true (Show Fullscreen Button) allows students to expand when needed.
        // smb=false, stb=false, stbh=false, ai=false cleans up unnecessary teacher toolbars.
        return `https://www.geogebra.org/material/iframe/id/${materialId}/rc/false/ai/false/sri/true/sfsb/true/smb/false/stb/false/stbh/false/ld/false/sdz/true`;
      }
      return target;
    }
  } catch (e) {
    // regex fallback
    const match = target.match(/geogebra\.org\/(?:m|classic|material\/iframe\/id)\/([a-zA-Z0-9]+)/);
    if (match) {
      return `https://www.geogebra.org/material/iframe/id/${match[1]}/rc/false/ai/false/sri/true/sfsb/true/smb/false/stb/false/stbh/false/ld/false/sdz/true`;
    }
  }

  return target.startsWith('http') ? target : `https://${target}`;
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
