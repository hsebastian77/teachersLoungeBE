const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'heic',
  'heif',
]);

const isHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const inferAttachmentType = (urlValue) => {
  try {
    const parsed = new URL(urlValue);
    const pathname = parsed.pathname || '';
    const extension = pathname.split('.').pop()?.toLowerCase();

    if (extension && IMAGE_EXTENSIONS.has(extension)) {
      return 'Image';
    }

    return 'Link';
  } catch (_) {
    return 'Link';
  }
};

const deriveDisplayName = (urlValue) => {
  try {
    const parsed = new URL(urlValue);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) {
      return null;
    }

    return decodeURIComponent(segments[segments.length - 1]);
  } catch (_) {
    return null;
  }
};

const normalizePostAttachment = ({ fileUrl, fileDisplayName, fileType }) => {
  const normalizedUrl = typeof fileUrl === 'string' ? fileUrl.trim() : '';

  if (!normalizedUrl) {
    return {
      fileUrl: null,
      fileDisplayName: null,
      fileType: null,
    };
  }

  if (!isHttpUrl(normalizedUrl)) {
    throw new Error('Invalid fileUrl. Only http/https links are allowed');
  }

  const normalizedDisplayName = typeof fileDisplayName === 'string' ? fileDisplayName.trim() : '';
  const normalizedType = typeof fileType === 'string' ? fileType.trim() : '';

  return {
    fileUrl: normalizedUrl,
    fileDisplayName: normalizedDisplayName || deriveDisplayName(normalizedUrl),
    fileType: normalizedType || inferAttachmentType(normalizedUrl),
  };
};

export { normalizePostAttachment, inferAttachmentType, isHttpUrl };
