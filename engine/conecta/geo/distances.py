"""
Cálculo de distâncias geodésicas ao backhaul de fibra mais próximo.

Usa BallTree do scipy com métrica haversine — O(n log n) para a construção
e O(m log n) para as consultas, adequado para os 5.570 municípios.

Raio da Terra adotado: 6371.0088 km (IUGG mean radius).
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

# Raio médio da Terra em km (IUGG)
EARTH_RADIUS_KM = 6371.0088


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância haversine entre dois pontos em graus decimais (WGS84), em km."""
    r = EARTH_RADIUS_KM
    φ1, φ2 = np.radians(lat1), np.radians(lat2)
    dφ = np.radians(lat2 - lat1)
    dλ = np.radians(lon2 - lon1)
    a = np.sin(dφ / 2) ** 2 + np.cos(φ1) * np.cos(φ2) * np.sin(dλ / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(a))


def add_backhaul_distances(
    municipios: pd.DataFrame,
    backhaul: pd.DataFrame,
) -> pd.DataFrame:
    """
    Adiciona a coluna ``dist_backhaul_km`` a cada município.

    Algoritmo:
    1. Converte lat/lon para coordenadas cartesianas 3-D na esfera unitária.
    2. Constrói um cKDTree sobre os pontos de backhaul.
    3. Para cada município, encontra o vizinho mais próximo e converte a
       distância euclidiana de volta para km na superfície esférica.
    4. Municípios que já constam no DataFrame de backhaul recebem 0.0.

    Args:
        municipios: DataFrame com colunas ``id_municipio``, ``lat``, ``lon``.
        backhaul:   DataFrame com colunas ``id_municipio``, ``lat``, ``lon``
                    (municípios que já possuem backhaul de fibra).

    Returns:
        Cópia do DataFrame ``municipios`` com a coluna ``dist_backhaul_km``
        preenchida (float, km).
    """
    if backhaul.empty:
        out = municipios.copy()
        out["dist_backhaul_km"] = np.nan
        return out

    # Conjunto de IDs que já têm backhaul
    ids_com_backhaul: set[str] = set(backhaul["id_municipio"].astype(str))

    # Coordenadas cartesianas na esfera unitária: (x, y, z)
    def _to_xyz(lat_deg: np.ndarray, lon_deg: np.ndarray) -> np.ndarray:
        lat = np.radians(lat_deg)
        lon = np.radians(lon_deg)
        x = np.cos(lat) * np.cos(lon)
        y = np.cos(lat) * np.sin(lon)
        z = np.sin(lat)
        return np.column_stack([x, y, z])

    bh_xyz = _to_xyz(
        backhaul["lat"].to_numpy(dtype=float),
        backhaul["lon"].to_numpy(dtype=float),
    )
    tree = cKDTree(bh_xyz)

    mun_xyz = _to_xyz(
        municipios["lat"].to_numpy(dtype=float),
        municipios["lon"].to_numpy(dtype=float),
    )

    # Distância euclidiana na esfera unitária → chord length
    chord, _ = tree.query(mun_xyz, k=1)

    # Converter chord length → distância geodésica em km
    # chord = 2 * sin(θ/2)  →  θ = 2 * arcsin(chord/2)
    chord_clipped = np.clip(chord, 0.0, 2.0)  # domínio seguro de arcsin
    dist_km = 2.0 * EARTH_RADIUS_KM * np.arcsin(chord_clipped / 2.0)

    out = municipios.copy()
    out["dist_backhaul_km"] = dist_km

    # Municípios que já têm backhaul: distância = 0
    mask = out["id_municipio"].astype(str).isin(ids_com_backhaul)
    out.loc[mask, "dist_backhaul_km"] = 0.0

    return out
