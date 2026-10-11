"""Nhập một lần các bài từ du_lieu_cu.json vào bảng nguồn cung.

Chạy trong thư mục backend:
    py -3.13 import_data.py
    py -3.13 import_data.py D:\\Downloads\\du_lieu_cu.json
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

from database import SessionLocal
from models import Property

VIDEO_URL_LIMIT = 1000


def load_posts(path: Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("du_lieu_cu.json phải là một mảng bài viết.")
    return raw


def as_url_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    urls = []
    for item in value:
        url = str(item or "").strip()
        if url and url not in urls:
            urls.append(url)
    return urls


def import_posts(path: Path) -> int:
    posts = load_posts(path)
    session = SessionLocal()
    saved = 0
    try:
        for index, item in enumerate(posts, start=1):
            if not isinstance(item, dict):
                print(f"Bỏ qua bài {index}: không phải đối tượng JSON.")
                continue
            content = str(item.get("noi_dung") or "").strip()
            images = as_url_list(item.get("images"))
            video_url = str(item.get("video_url") or "").strip()
            if len(video_url) > VIDEO_URL_LIMIT:
                print(f"Bài {index}: bỏ video vì đường dẫn dài hơn {VIDEO_URL_LIMIT} ký tự.")
                video_url = ""
            if not content and not images and not video_url:
                print(f"Bỏ qua bài {index}: không có nội dung, ảnh hoặc video.")
                continue
            row = Property(
                content=content or None,
                media_urls=json.dumps(images, ensure_ascii=False) if images else None,
                video_url=video_url or None,
                status="Chưa bán",
                created_at=datetime.now(),
            )
            try:
                session.add(row)
                session.commit()
                saved += 1
            except Exception as exc:
                session.rollback()
                print(f"Bỏ qua bài {index}: {exc}")
    finally:
        session.close()
    return saved


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else Path.cwd() / "du_lieu_cu.json"
    if not path.is_file():
        print(f"Không thấy file: {path}")
        sys.exit(1)
    saved = import_posts(path)
    print(f"Đã chuyển thành công {saved} bài viết.")


if __name__ == "__main__":
    main()
