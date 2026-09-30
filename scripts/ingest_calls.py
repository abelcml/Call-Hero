from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from src.repository import ingest_payload
from src.supabase_repository import SupabaseRepository


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import safe Call Hero dashboard records into Supabase."
    )
    parser.add_argument("json_path", type=Path)
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not service_key:
        raise SystemExit(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment."
        )

    from supabase import create_client

    payload = json.loads(args.json_path.read_text(encoding="utf-8"))
    repository = SupabaseRepository(create_client(url, service_key))
    batch = ingest_payload(payload, repository)
    print(
        "Imported "
        f"{len(batch.calls)} calls, "
        f"{len(batch.appointments)} appointments and "
        f"{len(batch.data_issues)} data issues."
    )


if __name__ == "__main__":
    main()
