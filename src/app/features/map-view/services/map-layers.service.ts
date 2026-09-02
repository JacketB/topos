import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';

export interface LayerInfo {
  id: string;
  name: string;
  visible: boolean;
}

export interface LayerGroupInfo {
  id: string;
  name: string;
  visible: boolean;
  expanded: boolean;
  layers: LayerInfo[];
}

@Injectable({
  providedIn: 'root'
})
export class MapLayersService {
  readonly groups = signal<LayerGroupInfo[]>([
    {
      id: 'elevation',
      name: 'Рельеф и высоты',
      visible: true,
      expanded: false,
      layers: [
        { id: 'hillshade_layer', name: 'Теневая отмывка рельефа (Hillshade)', visible: true },
        { id: 'contour_line', name: 'Горизонтали (Изогипсы)', visible: true },
        { id: 'contour_label', name: 'Отметки высот горизонталей', visible: true },
        { id: 'mountain_peak_labels', name: 'Вершины и командные высоты', visible: true }
      ]
    },
    {
      id: 'military',
      name: 'Военные объекты',
      visible: true,
      expanded: false,
      layers: [
        { id: 'military-fill', name: 'Зоны укрепрайонов', visible: true },
        { id: 'military-outline', name: 'Границы фортификаций', visible: true },
        { id: 'military-labels', name: 'Подписи военных объектов', visible: true }
      ]
    },
    {
      id: 'tactical',
      name: 'Тактическая обстановка',
      visible: true,
      expanded: false,
      layers: [
        { id: 'tactical_symbols_layer', name: 'Тактические знаки и иконки', visible: true },
        { id: 'measurement-line', name: 'Измерительные линии и маршруты', visible: true },
        { id: 'measurement-points', name: 'Узловые точки измерений', visible: true }
      ]
    },
    {
      id: 'hydro',
      name: 'Гидрография',
      visible: true,
      expanded: false,
      layers: [
        { id: 'water', name: 'Озера, водохранилища и пруды', visible: true },
        { id: 'waterway', name: 'Реки, ручьи и каналы', visible: true },
        { id: 'water_labels', name: 'Названия водоемов', visible: true },
        { id: 'waterway_labels', name: 'Названия рек и каналов', visible: true }
      ]
    },
    {
      id: 'landcover',
      name: 'Растительность и грунты',
      visible: true,
      expanded: false,
      layers: [
        { id: 'landcover_wood', name: 'Леса и лесные массивы', visible: true },
        { id: 'landuse_wood', name: 'Леспромхозы и посадки', visible: true },
        { id: 'landcover_grass', name: 'Луга, пастбища и поля', visible: true },
        { id: 'park', name: 'Парки и скверы', visible: true }
      ]
    },
    {
      id: 'transport',
      name: 'Дорожная сеть и транспорт',
      visible: true,
      expanded: false,
      layers: [
        { id: 'roads_major', name: 'Магистрали и шоссе', visible: true },
        { id: 'roads_minor', name: 'Второстепенные и местные дороги', visible: true },
        { id: 'transportation_path', name: 'Грунтовые дороги и тропы', visible: true },
        { id: 'transportation_rail', name: 'Железные дороги', visible: true },
        { id: 'aeroway', name: 'Взлетно-посадочные полосы и рулежки', visible: true },
        { id: 'transportation_labels', name: 'Названия улиц и трасс', visible: true }
      ]
    },
    {
      id: 'buildings',
      name: 'Застройка и сооружения',
      visible: true,
      expanded: false,
      layers: [
        { id: '3d_buildings', name: '3D-здания (Объемная застройка)', visible: true },
        { id: 'buildings', name: '2D-контуры строений', visible: true },
        { id: 'landuse_residential', name: 'Жилые и промышленные кварталы', visible: true },
        { id: 'housenumber_labels', name: 'Номера домов и адреса', visible: true }
      ]
    },
    {
      id: 'labels_boundary',
      name: 'Границы и населенные пункты',
      visible: true,
      expanded: false,
      layers: [
        { id: 'place_labels', name: 'Города, поселки и деревни', visible: true },
        { id: 'poi_labels', name: 'Точки интереса', visible: true },
        { id: 'aerodrome_labels', name: 'Аэродромы и вертолетные площадки', visible: true },
        { id: 'boundary_country', name: 'Государственная граница', visible: true },
        { id: 'boundary_region', name: 'Областные и районные границы', visible: true }
      ]
    }
  ]);

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const stored = localStorage.getItem('topos_map_layer_groups');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.groups.update(defaults => {
            return defaults.map(defGroup => {
              const savedGroup = parsed.find((g: any) => g.id === defGroup.id);
              if (!savedGroup) return defGroup;
              return {
                ...defGroup,
                visible: savedGroup.visible ?? defGroup.visible,
                expanded: savedGroup.expanded ?? defGroup.expanded,
                layers: defGroup.layers.map(defLayer => {
                  const savedLayer = savedGroup.layers?.find((l: any) => l.id === defLayer.id);
                  if (!savedLayer) return defLayer;
                  return { ...defLayer, visible: savedLayer.visible ?? defLayer.visible };
                })
              };
            });
          });
        }
      }
    } catch {}
  }

  private saveState() {
    try {
      localStorage.setItem('topos_map_layer_groups', JSON.stringify(this.groups()));
    } catch {}
  }

  applyAllLayersVisibility(map: maplibregl.Map | null) {
    if (!map) return;
    const currentGroups = this.groups();
    for (const group of currentGroups) {
      for (const layer of group.layers) {
        if (map.getLayer(layer.id)) {
          const isVisible = group.visible && layer.visible;
          map.setLayoutProperty(layer.id, 'visibility', isVisible ? 'visible' : 'none');
          if (layer.id === 'boundary_country' && map.getLayer('boundary_country_halo')) {
            map.setLayoutProperty('boundary_country_halo', 'visibility', isVisible ? 'visible' : 'none');
          }
        }
      }
    }
  }

  toggleGroupExpansion(groupId: string) {
    this.groups.update(currentGroups => 
      currentGroups.map(group => 
        group.id === groupId ? { ...group, expanded: !group.expanded } : group
      )
    );
    this.saveState();
  }

  toggleGroup(groupId: string, map: maplibregl.Map | null) {
    this.groups.update(currentGroups => 
      currentGroups.map(group => {
        if (group.id !== groupId) return group;

        const newGroupVisible = !group.visible;
        const updatedLayers = group.layers.map(layer => {
          if (map && map.getLayer(layer.id)) {
            map.setLayoutProperty(layer.id, 'visibility', newGroupVisible ? 'visible' : 'none');
            if (layer.id === 'boundary_country' && map.getLayer('boundary_country_halo')) {
              map.setLayoutProperty('boundary_country_halo', 'visibility', newGroupVisible ? 'visible' : 'none');
            }
          }
          return { ...layer, visible: newGroupVisible };
        });

        return { ...group, visible: newGroupVisible, layers: updatedLayers };
      })
    );
    this.saveState();
  }

  toggleLayer(layerId: string, map: maplibregl.Map | null) {
    this.groups.update(currentGroups => 
      currentGroups.map(group => {
        const hasLayer = group.layers.some(l => l.id === layerId);
        if (!hasLayer) return group;

        const updatedLayers = group.layers.map(layer => {
          if (layer.id !== layerId) return layer;
          const newVisible = !layer.visible;
          if (map && map.getLayer(layer.id)) {
            map.setLayoutProperty(layer.id, 'visibility', newVisible ? 'visible' : 'none');
            if (layer.id === 'boundary_country' && map.getLayer('boundary_country_halo')) {
              map.setLayoutProperty('boundary_country_halo', 'visibility', newVisible ? 'visible' : 'none');
            }
          }
          return { ...layer, visible: newVisible };
        });

        const anyVisible = updatedLayers.some(l => l.visible);
        return { ...group, visible: anyVisible, layers: updatedLayers };
      })
    );
    this.saveState();
  }
}
