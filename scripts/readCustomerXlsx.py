#!/usr/bin/env python3
"""Read the first XLSX worksheet and emit its rows as column-keyed JSON."""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def main(path):
    with zipfile.ZipFile(path) as archive:
        shared = []
        root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        for item in root.findall(NS + "si"):
            shared.append("".join(node.text or "" for node in item.iter(NS + "t")))

        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row_number, row in enumerate(sheet.iter(NS + "row"), start=1):
            if row_number == 1:
                continue
            result = {}
            for cell in row.findall(NS + "c"):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                value_node = cell.find(NS + "v")
                value = "" if value_node is None else value_node.text
                if cell.attrib.get("t") == "s" and value:
                    value = shared[int(value)]
                elif cell.attrib.get("t") == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iter(NS + "t"))
                result[column] = value or ""
            rows.append(result)
        json.dump(rows, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1])
