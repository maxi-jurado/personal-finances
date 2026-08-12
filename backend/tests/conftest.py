"""Configuración de tests.

Fuerza `DATABASE_URL` a una SQLite temporal ANTES de importar la app, para que
el engine a nivel de módulo nunca apunte a la base real `finanzas.db`.
"""

import os
import tempfile
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="finanzas-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DIR / 'test.db'}"
