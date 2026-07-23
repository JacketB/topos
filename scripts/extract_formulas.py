import openpyxl
import sys

sys.stdout.reconfigure(encoding='utf-8')

wb = openpyxl.load_workbook("F:/Vanya/fort_calculator.xlsx", data_only=False)
sheet = wb['Ходы_сообщения_и_Траншеи']

output_path = "F:/Vanya/formulas_output.txt"
with open(output_path, "w", encoding="utf-8") as f:
    f.write("=== EXCEL FORMULAS FOR TRENCHES ===\n")
    for r in range(30, 51):
        vals = []
        for c in range(1, 8):
            cell = sheet.cell(row=r, column=c)
            val = str(cell.value) if cell.value is not None else ""
            vals.append(f"{cell.coordinate}: {val}")
        f.write(" | ".join(vals) + "\n")

print(f"Formulas written to {output_path}")
