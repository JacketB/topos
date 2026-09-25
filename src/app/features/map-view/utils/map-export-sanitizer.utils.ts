export class MapExportSanitizerUtils {
  static sanitizeStyleForNative(styleObj: any, dpiRatio: number = 1.0): any {
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
        return ['coalesce', ...expr.slice(1).map((item: any) => sanitizeExpr(item))];
      }

      return expr.map((item: any) => sanitizeExpr(item));
    };

    const scaleNumberOrExpr = (val: any, ratio: number): any => {
      if (typeof val === 'number') {
        return val * ratio;
      }
      if (Array.isArray(val)) {
        if (val[0] === 'interpolate' && Array.isArray(val[2]) && val[2][0] === 'zoom') {
          const clonedArr = [...val];
          for (let i = 3; i < clonedArr.length; i += 2) {
            if (typeof clonedArr[i + 1] === 'number') {
              clonedArr[i + 1] = clonedArr[i + 1] * ratio;
            }
          }
          return clonedArr;
        }
        if (val[0] === 'coalesce') {
          const clonedArr = [...val];
          for (let i = 1; i < clonedArr.length; i++) {
            if (typeof clonedArr[i] === 'number') {
              clonedArr[i] = clonedArr[i] * ratio;
            } else if (Array.isArray(clonedArr[i])) {
              clonedArr[i] = scaleNumberOrExpr(clonedArr[i], ratio);
            }
          }
          return clonedArr;
        }
      }
      return val;
    };

    const isOverlayLayer = (l: any) => {
      const id = l.id || '';
      const src = l.source || '';
      const type = l.type || '';
      return id.startsWith('tactical_') || 
             id.startsWith('measurement-') || 
             id.startsWith('range-rings-') || 
             id.startsWith('drawing-') || 
             id.startsWith('viewshed-') || 
             id.startsWith('layer-img-overlay-') ||
             id.startsWith('layer-') ||
             id.startsWith('march_') ||
             src.startsWith('src-img-overlay-') ||
             src.startsWith('src-') ||
             src === 'march-places' ||
             src === 'march-kilometers' ||
             src === 'playback-source' ||
             type === 'raster' ||
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
      if (layer.paint) {
        if (!isOverlayLayer(layer)) {
          if (layer.type === 'fill') {
            const id = layer.id || '';
            const srcLayer = layer['source-layer'] || '';
            if (id.includes('wood') || id.includes('forest') || srcLayer === 'landcover' || srcLayer === 'landuse') {
              if (id.includes('wood') || id.includes('forest')) {
                layer.paint['fill-color'] = '#d8ead2';
                layer.paint['fill-opacity'] = 0.45;
              } else if (id.includes('grass') || id.includes('meadow') || id.includes('park')) {
                layer.paint['fill-color'] = '#eaf2e3';
                layer.paint['fill-opacity'] = 0.40;
              } else if (id.includes('residential') || id.includes('industrial') || id.includes('commercial')) {
                layer.paint['fill-color'] = '#eae8e4';
                layer.paint['fill-opacity'] = 0.45;
              }
            } else if (id === 'water' || srcLayer === 'water' || id.includes('water')) {
              layer.paint['fill-color'] = '#b8d8f0';
            }
          } else if (layer.type === 'background') {
            layer.paint['background-color'] = '#f8faf6';
          } else if (layer.type === 'line') {
            const id = layer.id || '';
            const srcLayer = layer['source-layer'] || '';
            if (id === 'waterway' || id.includes('waterway') || srcLayer === 'waterway') {
              layer.paint['line-color'] = '#9bbcd6';
              layer.paint['line-opacity'] = 0.70;
            } else if (id === 'roads_major' || (srcLayer === 'transportation' && id.includes('major') && !id.includes('casing'))) {
              layer.paint['line-color'] = '#f59e0b';
              layer.paint['line-opacity'] = 0.95;
            } else if (id === 'roads_major_casing' || (srcLayer === 'transportation' && id.includes('major_casing'))) {
              layer.paint['line-color'] = '#b45309';
              layer.paint['line-opacity'] = 0.90;
            } else if (id === 'roads_minor' || (srcLayer === 'transportation' && id.includes('minor') && !id.includes('casing'))) {
              layer.paint['line-color'] = '#f5f5f3';
              layer.paint['line-opacity'] = 0.85;
            } else if (id === 'roads_minor_casing' || (srcLayer === 'transportation' && id.includes('minor_casing'))) {
              layer.paint['line-color'] = '#ded9cf';
              layer.paint['line-opacity'] = 0.60;
            } else if (id === 'transportation_rail' || id.includes('rail')) {
              layer.paint['line-color'] = '#a8a29e';
              layer.paint['line-opacity'] = 0.60;
            } else if (id === 'transportation_path' || id.includes('path') || id.includes('track')) {
              layer.paint['line-color'] = '#d1cbbf';
              layer.paint['line-opacity'] = 0.50;
            } else if (id.includes('boundary_country_halo')) {
              layer.paint['line-color'] = '#e09fab';
              layer.paint['line-opacity'] = 0.15;
            } else if (id.includes('boundary_country')) {
              layer.paint['line-color'] = '#9e5a6d';
              layer.paint['line-opacity'] = 0.60;
            } else if (id.includes('boundary_region')) {
              layer.paint['line-color'] = '#8e9aa8';
              layer.paint['line-opacity'] = 0.50;
            } else if (id.includes('contour_line') || id.includes('contour')) {
              layer.paint['line-color'] = '#c2a893';
              layer.paint['line-opacity'] = 0.45;
            }
          }
        }

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

        if (layer.paint['line-width'] !== undefined) {
          const isOverlay = isOverlayLayer(layer);
          const widthRatio = isOverlay ? dpiRatio : Math.min(1.25, 1.0 + (dpiRatio - 1.0) * 0.05);
          layer.paint['line-width'] = scaleNumberOrExpr(layer.paint['line-width'], widthRatio);
        }
        if (layer.paint['circle-radius'] !== undefined) {
          layer.paint['circle-radius'] = scaleNumberOrExpr(layer.paint['circle-radius'], dpiRatio);
        }
        if (layer.paint['circle-stroke-width'] !== undefined) {
          layer.paint['circle-stroke-width'] = scaleNumberOrExpr(layer.paint['circle-stroke-width'], dpiRatio);
        }
        if (layer.paint['text-halo-width'] !== undefined) {
          layer.paint['text-halo-width'] = scaleNumberOrExpr(layer.paint['text-halo-width'], dpiRatio);
        } else if (layer.type === 'symbol') {
          layer.paint['text-halo-width'] = 2.0 * dpiRatio;
          layer.paint['text-halo-color'] = '#ffffff';
        }

        for (const prop of Object.keys(layer.paint)) {
          layer.paint[prop] = sanitizeExpr(layer.paint[prop]);
        }
      }

      if (layer.layout) {
        for (const prop of Object.keys(layer.layout)) {
          layer.layout[prop] = sanitizeExpr(layer.layout[prop]);
        }

        if (layer.type === 'symbol') {
          if (!isOverlayLayer(layer)) {
            if (layer.id === 'waterway_labels' || layer.id === 'water_labels') {
              if (layer.paint) layer.paint['text-color'] = '#5a8cae';
            } else if (layer.id === 'transportation_labels') {
              if (layer.paint) layer.paint['text-color'] = '#78716c';
            } else if (layer.id === 'contour_label') {
              if (layer.paint) layer.paint['text-color'] = '#9c7b63';
            }
          }

          if (!layer.layout['text-font'] || (Array.isArray(layer.layout['text-font']) && layer.layout['text-font'].length > 1)) {
            layer.layout['text-font'] = ['Noto Sans Regular'];
          }

          if (layer.id === 'march_places_dots') {
            layer.layout = layer.layout || {};
            layer.layout['visibility'] = 'none';
          } else if (layer.id === 'march_places_labels') {
            layer.layout['text-size'] = scaleNumberOrExpr(layer.layout['text-size'] || 13, dpiRatio);
            layer.layout['text-padding'] = 6 * dpiRatio;
            layer.layout['text-allow-overlap'] = false;
            layer.layout['text-ignore-placement'] = false;
            layer.layout['text-anchor'] = ['coalesce', ['get', 'textAnchor'], 'center'];
            layer.layout['text-offset'] = ['coalesce', ['get', 'textOffset'], ['literal', [0, 0]]];
          } else if (layer.id === 'place_labels' || layer.source === 'belarus-data' && layer['source-layer'] === 'place') {
            const marchPlacesSource = cloned.sources?.['march-places'];
            const hasActiveMarchPlaces = marchPlacesSource?.data?.features && marchPlacesSource.data.features.length > 0;
            if (hasActiveMarchPlaces) {
              layer.layout['visibility'] = 'none';
            } else {
              layer.layout['text-size'] = [
                'interpolate', ['linear'], ['zoom'],
                4, Math.max(8, 6 * dpiRatio),
                7, Math.max(9, 7.5 * dpiRatio),
                10, Math.max(11, 9 * dpiRatio),
                14, Math.max(13, 11 * dpiRatio)
              ];
              layer.layout['text-allow-overlap'] = false;
              layer.layout['text-ignore-placement'] = false;
              layer.layout['text-padding'] = 2 * dpiRatio;
            }
          } else if (layer.layout['text-size'] !== undefined) {
            layer.layout['text-size'] = scaleNumberOrExpr(layer.layout['text-size'], dpiRatio);
          }

          if (layer.id.startsWith('tactical_') || layer.source === 'tactical-symbols') {
            layer.layout['text-field'] = '';
          }
        }

        if (layer.layout['icon-size'] !== undefined) {
          layer.layout['icon-size'] = scaleNumberOrExpr(layer.layout['icon-size'], dpiRatio);
        }
      }
    }

    if (cloned.sources) {
      for (const srcKey of Object.keys(cloned.sources)) {
        const src = cloned.sources[srcKey];
        if (src && src.type === 'raster') {
          const tilesStr = Array.isArray(src.tiles) ? src.tiles.join(' ') : (src.url || '');
          if (tilesStr.includes('virtualearth.net')) {
            src.maxzoom = Math.min(typeof src.maxzoom === 'number' ? src.maxzoom : 18, 18);
          } else if (tilesStr.includes('google.com')) {
            src.maxzoom = Math.min(typeof src.maxzoom === 'number' ? src.maxzoom : 19, 19);
          } else if (typeof src.maxzoom === 'number' && src.maxzoom > 19) {
            src.maxzoom = 19;
          }
        }
      }
    }

    cloned.glyphs = 'http://topos.localhost/fonts/{fontstack}/{range}.pbf';

    const baseLayers: any[] = [];
    const overlayLayers: any[] = [];

    for (const layer of cloned.layers) {
      if (layer.id === 'tactical_lines_layer' && !cloned.layers.some((l: any) => l.id === 'tactical_lines_casing_export')) {
        overlayLayers.push({
          id: 'tactical_lines_casing_export',
          type: 'line',
          source: 'tactical-symbols',
          filter: ['==', '$type', 'LineString'],
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': ['+', ['coalesce', ['get', 'lineWidth'], 3.5 * dpiRatio], 3.0 * dpiRatio],
            'line-opacity': 0.95
          }
        });
      }

      if (isOverlayLayer(layer)) {
        overlayLayers.push(layer);
      } else {
        baseLayers.push(layer);
      }
    }

    cloned.layers = [...baseLayers, ...overlayLayers];

    return cloned;
  }

  static enrichGeoJsonForNative(data: any, dpiRatio: number = 1.0): any {
    if (!data || typeof data !== 'object') return data;
    const cloned = structuredClone(data);

    if (cloned.type === 'FeatureCollection' && Array.isArray(cloned.features)) {
      for (const feature of cloned.features) {
        if (!feature.properties) feature.properties = {};
        const props = feature.properties;

        if (feature.geometry && feature.geometry.type === 'Point') {
          const baseSize = typeof props.size === 'number' && props.size > 0 ? props.size : 0.08;
          props.size = props.symbol === 'text_box' ? 0 : baseSize * dpiRatio;
        }

        if (props.symbol && !props.iconId) {
          props.iconId = props.symbol;
        }
        if (!props.color) {
          props.color = props.symbol ? '#ef4444' : '#854d0e';
        }
        if (props.lineWidth === undefined) {
          props.lineWidth = 3.5 * dpiRatio;
        } else if (typeof props.lineWidth === 'number') {
          props.lineWidth = props.lineWidth * dpiRatio;
        }
        if (props.fillOpacity === undefined) {
          props.fillOpacity = 0.4;
        }
      }
    }

    return cloned;
  }

  static enrichFeaturesArrayForNative(features: any[], dpiRatio: number = 1.0): any[] {
    if (!Array.isArray(features)) return [];
    return features.map(f => {
      const feat = structuredClone(f);
      if (!feat.properties) feat.properties = {};
      const props = feat.properties;

      if (feat.geometry && feat.geometry.type === 'Point') {
        const baseSize = typeof props.size === 'number' && props.size > 0 ? props.size : 0.08;
        props.size = props.symbol === 'text_box' ? 0 : baseSize * dpiRatio;
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
        props.lineWidth = 3.5 * dpiRatio;
      } else if (typeof props.lineWidth === 'number') {
        props.lineWidth = props.lineWidth * dpiRatio;
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
      if (img.data.data && typeof img.data.width === 'number') {
        width = img.data.width;
        height = img.data.height;
        rawBuffer = img.data.data;
      } else if (img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray) {
        width = img.width || 0;
        height = img.height || 0;
        rawBuffer = img.data;
      }
    }

    if (!rawBuffer && img.userImage) {
      if (img.userImage.data && img.userImage.data.data) {
        width = img.userImage.data.width || img.userImage.width || 0;
        height = img.userImage.data.height || img.userImage.height || 0;
        rawBuffer = img.userImage.data.data;
      } else if (img.userImage.data) {
        width = img.userImage.width || 0;
        height = img.userImage.height || 0;
        rawBuffer = img.userImage.data;
      }
    }

    if (!rawBuffer && typeof img.width === 'number' && typeof img.height === 'number') {
      width = img.width;
      height = img.height;
      if (img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray) {
        rawBuffer = img.data;
      }
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
      }
    }

    return null;
  }
}
