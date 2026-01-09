import argparse
import json
import os
import sys

import cv2
import numpy as np


def load_layout(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_image(path):
    image = cv2.imread(path)
    if image is None:
        raise RuntimeError("Image not found")
    return image


def preprocess(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15
    )
    return thresh


def region_to_pixels(region, image_shape):
    h, w = image_shape[:2]
    x = int(region["x"] * w)
    y = int(region["y"] * h)
    rw = int(region["w"] * w)
    rh = int(region["h"] * h)
    return x, y, rw, rh


def extract_grid_fills(thresh, region):
    rows = region["rows"]
    cols = region["cols"]
    x, y, w, h = region_to_pixels(region, thresh.shape)
    cell_w = w / cols
    cell_h = h / rows
    fills = []
    for r in range(rows):
        row = []
        for c in range(cols):
            cx = int(x + c * cell_w)
            cy = int(y + r * cell_h)
            pad_x = int(cell_w * 0.2)
            pad_y = int(cell_h * 0.2)
            rx = cx + pad_x
            ry = cy + pad_y
            rw = int(cell_w - 2 * pad_x)
            rh = int(cell_h - 2 * pad_y)
            roi = thresh[ry : ry + rh, rx : rx + rw]
            if roi.size == 0:
                row.append(0.0)
            else:
                row.append(float(np.mean(roi) / 255.0))
        fills.append(row)
    return fills


def pick_index(values, min_fill=0.25, min_delta=0.08):
    max_val = max(values)
    idx = int(np.argmax(values))
    sorted_vals = sorted(values, reverse=True)
    second = sorted_vals[1] if len(sorted_vals) > 1 else 0.0
    if max_val < min_fill:
        return None
    if (max_val - second) < min_delta:
        return None
    return idx


def extract_student_number(fills, warnings):
    rows = len(fills)
    cols = len(fills[0]) if rows else 0
    digits = []
    for col in range(cols):
        column = [fills[row][col] for row in range(rows)]
        idx = pick_index(column)
        digits.append(idx)
    if cols >= 11:
        digits = digits[-8:]
    number = ""
    for idx in digits:
        if idx is None:
            number += "?"
            warnings.append("Student number missing")
        else:
            number += str(idx)
    return number


def extract_answers(fills, warnings):
    options = ["A", "B", "C", "D", "E"]
    answers = []
    for row in fills:
        idx = pick_index(row)
        if idx is None:
            answers.append("?")
            warnings.append("Unclear answer")
        else:
            answers.append(options[idx])
    return answers


def draw_debug(image, layout, answers, student_number, output_path):
    debug = image.copy()
    for key, region in layout["regions"].items():
        x, y, w, h = region_to_pixels(region, debug.shape)
        cv2.rectangle(debug, (x, y), (x + w, y + h), (0, 255, 0), 2)
        cv2.putText(debug, key, (x + 4, y + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 0), 2)
    cv2.putText(debug, f"student:{student_number}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)
    cv2.imwrite(output_path, debug)


def run(mode, image_path, layout_path):
    layout = load_layout(layout_path)
    image = load_image(image_path)
    thresh = preprocess(image)
    warnings = []

    tc_region = layout["regions"]["tc"]
    tr_region = layout["regions"]["turkish"]

    tc_fills = extract_grid_fills(thresh, tc_region)
    tr_fills = extract_grid_fills(thresh, tr_region)

    student_number = extract_student_number(tc_fills, warnings)
    answers = extract_answers(tr_fills, warnings)

    output = {
        "answers": answers,
        "total": len(answers),
        "warnings": warnings,
        "studentNumber": student_number
    }

    debug_name = os.path.splitext(os.path.basename(image_path))[0] + "_debug.jpg"
    debug_path = os.path.join(os.path.dirname(image_path), debug_name)
    draw_debug(image, layout, answers, student_number, debug_path)
    output["debugImage"] = debug_path

    if mode == "answer":
        return output
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["answer", "grade"], required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--layout", required=True)
    args = parser.parse_args()

    result = run(args.mode, args.image, args.layout)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
