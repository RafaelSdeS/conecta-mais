"""Abre um .zip remoto lendo só as faixas de bytes necessárias (sem baixar o arquivo inteiro)."""

from __future__ import annotations

import io
import zipfile

import requests

_HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}


class _HttpFile(io.RawIOBase):
    def __init__(self, url: str):
        self.url = url
        head = requests.head(url, headers=_HEADERS, allow_redirects=True, timeout=30)
        head.raise_for_status()
        self.size = int(head.headers["content-length"])
        self.pos = 0

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, offset: int, whence: int = 0) -> int:
        self.pos = offset if whence == 0 else (self.pos + offset if whence == 1 else self.size + offset)
        return self.pos

    def readinto(self, buffer) -> int:
        n = min(len(buffer), self.size - self.pos)
        if n <= 0:
            return 0
        resp = requests.get(
            self.url, headers={**_HEADERS, "Range": f"bytes={self.pos}-{self.pos + n - 1}"}, timeout=180
        )
        resp.raise_for_status()
        data = resp.content
        buffer[: len(data)] = data
        self.pos += len(data)
        return len(data)


def open_zip(url: str) -> zipfile.ZipFile:
    # Buffer grande: o zip é lido em blocos de 16 MB, não em milhares de requisições pequenas.
    return zipfile.ZipFile(io.BufferedReader(_HttpFile(url), buffer_size=16 * 1024 * 1024))
