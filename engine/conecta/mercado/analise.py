"""Construir × comprar: leitura da rede de fibra já instalada por provedores de pequeno porte (PPPs)."""

from __future__ import annotations

MIN_FIBRA_PPP = 200          # acessos de fibra para uma PPP entrar como candidata
PENETRACAO_ATENDIDA = 0.60   # fibra total ≥ 60 % dos domicílios: mercado já atendido
PENETRACAO_PPP = 0.15        # fibra das PPPs ≥ 15 % dos domicílios: há rede relevante para comprar/parceria


def analisar_mercado(provedores: list[dict], domicilios: int) -> dict:
    """
    Compara construir rede própria com comprar ou fazer parceria com PPPs que já têm fibra no município.

    Heurística de triagem com os acessos publicados pela Anatel; não avalia preço, qualidade da rede
    nem viabilidade jurídica da operação.
    """
    dom = max(int(domicilios), 1)
    fibra_total = sum(p["acessos_fibra"] for p in provedores)
    ppps = [p for p in provedores if p["porte"] == "Pequeno Porte"]
    fibra_ppp = sum(p["acessos_fibra"] for p in ppps)
    candidatas = sorted(
        (p for p in ppps if p["acessos_fibra"] >= MIN_FIBRA_PPP),
        key=lambda p: p["acessos_fibra"],
        reverse=True,
    )[:5]

    pen_total, pen_ppp = fibra_total / dom, fibra_ppp / dom
    if pen_total >= PENETRACAO_ATENDIDA:
        leitura = (
            "Mercado de fibra já bem atendido: construir rede nova tende a sobrepor a existente. "
            "Avalie parceria ou compra de rede."
        )
    elif pen_ppp >= PENETRACAO_PPP and candidatas:
        leitura = (
            "Há PPPs com rede de fibra relevante: avalie comprar ou fazer parceria antes de construir."
        )
    else:
        leitura = "Pouca fibra instalada: construir rede própria é a opção natural."

    return {
        "domicilios": dom,
        "penetracao_fibra_total": round(pen_total, 3),
        "penetracao_fibra_ppp": round(pen_ppp, 3),
        "n_provedores": len(provedores),
        "candidatas_compra_ou_parceria": [
            {
                "empresa": p["empresa"], "cnpj": p["cnpj"], "acessos_fibra": int(p["acessos_fibra"]),
                "acessos": int(p["acessos"]),
                "fibra_sobre_domicilios": round(p["acessos_fibra"] / dom, 3),
            }
            for p in candidatas
        ],
        "provedores": [
            {
                "empresa": p["empresa"], "grupo": p["grupo"], "porte": p["porte"],
                "acessos": int(p["acessos"]), "acessos_fibra": int(p["acessos_fibra"]),
            }
            for p in provedores[:10]
        ],
        "leitura": leitura,
        "aviso": "Triagem pelos acessos da Anatel; não considera preço, qualidade da rede nem aspectos jurídicos.",
    }
