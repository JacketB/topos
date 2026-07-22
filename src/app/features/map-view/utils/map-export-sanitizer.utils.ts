export class MapExportSanitizerUtils {
  static sanitizeStyleForNative(styleObj: any): any {
    if (!styleObj || !Array.isArray(styleObj.layers)) return styleObj;
    const cloned = structuredClone(styleObj);

    const sanitizeExpr = (expr: any): any => {
      if (!expr) return expr;
      if (typeof expr === 'string' || typeof expr === 'number' || typeof expr === 'boolean') {
        return expr;
      }
      if (!Array.isArray(expr)) return expr;

      const op = expr[0];
      if (op === 'coalesce') {
        return expr[1] ? sanitizeExpr(expr[1]) : expr;
      }

      return expr.map((item: any) => sanitizeExpr(item));
    };

    for (const layer of cloned.layers) {
      if (layer.paint) {
        if (layer.paint['line-dasharray'] && Array.isArray(layer.paint['line-dasharray'])) {
          const isDataDriven = JSON.stringify(layer.paint['line-dasharray']).includes('"get"');
          if (isDataDriven) {
            delete layer.paint['line-dasharray'];
          }
        }
        if (layer.paint['line-pattern'] && Array.isArray(layer.paint['line-pattern'])) {
          delete layer.paint['line-pattern'];
        }
        if (layer.paint['fill-pattern'] && Array.isArray(layer.paint['fill-pattern'])) {
          delete layer.paint['fill-pattern'];
        }

        for (const prop of Object.keys(layer.paint)) {
          layer.paint[prop] = sanitizeExpr(layer.paint[prop]);
        }
      }

      if (layer.layout) {
        for (const prop of Object.keys(layer.layout)) {
          layer.layout[prop] = sanitizeExpr(layer.layout[prop]);
        }

        if (layer.type === 'symbol' && (layer.id.startsWith('tactical_') || layer.source === 'tactical-symbols')) {
          if (!layer.layout) layer.layout = {};
          layer.layout['text-field'] = '{name}';
          layer.layout['text-font'] = ['Noto Sans Regular'];
          layer.layout['text-size'] = 16;
          layer.layout['text-offset'] = [0, 1.8];
          layer.layout['text-anchor'] = 'top';
          layer.layout['text-allow-overlap'] = true;
          layer.layout['text-ignore-placement'] = true;

          if (!layer.paint) layer.paint = {};
          layer.paint['text-color'] = '#000000';
          layer.paint['text-halo-color'] = '#ffffff';
          layer.paint['text-halo-width'] = 4.0;
        }
      }
    }

    cloned.glyphs = 'https://cdn.jsdelivr.net/gh/openmaptiles/fonts@gh-pages/{fontstack}/{range}.pbf';

    const baseLayers: any[] = [];
    const overlayLayers: any[] = [];

    const isOverlayLayer = (l: any) => {
      const id = l.id || '';
      const src = l.source || '';
      return id.startsWith('tactical_') || 
             id.startsWith('measurement-') || 
             id.startsWith('range-rings-') || 
             id.startsWith('drawing-') || 
             id.startsWith('viewshed-') || 
             src === 'tactical-symbols' || 
             src === 'tactical-lines' || 
             src === 'tactical-polygons' || 
             src === 'measurement-data' || 
             src === 'range-rings-data' || 
             src === 'drawing-data' || 
             src === 'viewshed-data' || 
             src === 'drawing-preview';
    };

    for (const layer of cloned.layers) {
      if (isOverlayLayer(layer)) {
        overlayLayers.push(layer);
      } else {
        baseLayers.push(layer);
      }
    }

    cloned.layers = [...baseLayers, ...overlayLayers];

    return cloned;
  }

  static enrichGeoJsonForNative(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const cloned = structuredClone(data);

    if (cloned.type === 'FeatureCollection' && Array.isArray(cloned.features)) {
      for (const feature of cloned.features) {
        if (!feature.properties) feature.properties = {};
        const props = feature.properties;

        if (feature.geometry && feature.geometry.type === 'Point') {
          props.size = 0.07;
        }

        if (props.symbol && !props.iconId) {
          props.iconId = props.symbol;
        }
        if (!props.color) {
          props.color = props.symbol ? '#ef4444' : '#854d0e';
        }
        if (props.lineWidth === undefined) {
          props.lineWidth = 3.5;
        }
        if (props.fillOpacity === undefined) {
          props.fillOpacity = 0.4;
        }
      }
    }

    return cloned;
  }

  static enrichFeaturesArrayForNative(features: any[]): any[] {
    if (!Array.isArray(features)) return [];
    return features.map(f => {
      const feat = structuredClone(f);
      if (!feat.properties) feat.properties = {};
      const props = feat.properties;

      if (feat.geometry && feat.geometry.type === 'Point') {
        props.size = 0.07;
      }

      if (props.symbol && !props.iconId) {
        props.iconId = props.symbol;
      }
      if (!props.name) {
        props.name = props.label || props.title || props.text || '';
      }
      if (!props.color) {
        props.color = props.symbol ? '#ef4444' : '#854d0e';
      }
      if (props.lineWidth === undefined) {
        props.lineWidth = 3.5;
      }
      if (props.fillOpacity === undefined) {
        props.fillOpacity = 0.4;
      }
      return feat;
    });
  }

  static getStyleImageDataUrl(img: any): { url: string; width: number; height: number } | null {
    if (!img) return null;

    const htmlElem = img.userImage?.display || img.userImage || img;
    if (htmlElem && typeof htmlElem.getContext === 'function') {
      try {
        return {
          url: htmlElem.toDataURL('image/png'),
          width: htmlElem.width,
          height: htmlElem.height
        };
      } catch {}
    }

    if (htmlElem instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && htmlElem instanceof ImageBitmap)) {
      try {
        const w = htmlElem.width;
        const h = htmlElem.height;
        if (w > 0 && h > 0) {
          const cvs = document.createElement('canvas');
          cvs.width = w;
          cvs.height = h;
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.drawImage(htmlElem, 0, 0);
            return { url: cvs.toDataURL('image/png'), width: w, height: h };
          }
        }
      } catch {}
    }

    let width = 0;
    let height = 0;
    let rawBuffer: Uint8Array | Uint8ClampedArray | null = null;

    if (img.data) {
      width = img.width || 0;
      height = img.height || 0;
      rawBuffer = img.data;
    } else if (img.userImage && img.userImage.data) {
      width = img.userImage.width || 0;
      height = img.userImage.height || 0;
      rawBuffer = img.userImage.data;
    }

    if (width > 0 && height > 0 && rawBuffer && rawBuffer.length >= width * height * 4) {
      try {
        const cvs = document.createElement('canvas');
        cvs.width = width;
        cvs.height = height;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          const imgData = ctx.createImageData(width, height);
          imgData.data.set(rawBuffer.subarray(0, width * height * 4));
          ctx.putImageData(imgData, 0, 0);
          return { url: cvs.toDataURL('image/png'), width, height };
        }
      } catch (e) {
        console.error('Error converting raw pixels for style image:', e);
      }
    }

    return null;
  }
}
