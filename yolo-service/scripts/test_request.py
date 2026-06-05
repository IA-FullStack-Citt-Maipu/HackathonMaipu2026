"""Send a test image to the YOLO microservice."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send a test image to the YOLO service.")
    parser.add_argument("--image", required=True, help="Path to the image file to upload.")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8001",
        help="Base URL of the YOLO service.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image_path = Path(args.image)
    if not image_path.exists():
        raise SystemExit(f"Image file not found: {image_path}")

    with image_path.open("rb") as image_file:
        response = requests.post(
            f"{args.base_url}/api/yolo/detect/image",
            files={"file": (image_path.name, image_file, "image/jpeg")},
            timeout=120,
        )

    print(f"HTTP {response.status_code}")
    try:
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
    except ValueError:
        print(response.text)


if __name__ == "__main__":
    main()
