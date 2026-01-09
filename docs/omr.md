# OMR Processing (A booklet, fixed layout)

This project uses a small Python/OpenCV helper to read an answer key sheet and a student sheet.

## Requirements
- Python 3.10+
- Packages: `opencv-python`, `numpy`

```bash
pip install opencv-python numpy
```

Optional:
- `OMR_PYTHON` env var to point to the python executable.

## Files
- `services/api/src/modules/omr/omr.py`
- `services/api/src/modules/omr/layout.json` (normalized regions)

## Flow
1) `POST /omr/answer-key` with `{ courseId, objectKey }`
   - Extracts Turkish answers (1-20).
   - Saves to `storage/omr/answer-keys/<courseId>.json`.
2) `POST /omr/grade` with `{ courseId, objectKey }`
   - Extracts student number (TC area, last 8 digits).
   - Compares to answer key and saves score to `examResults`.

## Tuning
If detection is off, adjust the normalized region coordinates in `layout.json`.
Debug images are saved next to the temporary input file in `storage/omr/`.
