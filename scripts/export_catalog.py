import json
from pathlib import Path
import sys

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    "/Users/macbook/Downloads/proje_destek_programlari_codex_katalogu.xlsx"
)


def rows(sheet_name):
    frame = pd.read_excel(WORKBOOK, sheet_name=sheet_name).fillna("")
    return frame.to_dict(orient="records")


payload = {
    "catalog": rows("Proje_Destek_Katalogu"),
    "sources": rows("Kaynak_Kayitlari"),
    "schema": rows("Codex_Veri_Semasi"),
    "enums": rows("Enum_Degerleri"),
    "readme": rows("README"),
    "exportedAt": pd.Timestamp.utcnow().isoformat(),
}

output = ROOT / "src" / "data" / "catalog.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Exported {len(payload['catalog'])} programmes and {len(payload['sources'])} sources.")
