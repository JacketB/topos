import openpyxl
import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = "C:/Users/user/Desktop/Авто-расчет.xlsx"
wb = openpyxl.load_workbook(file_path, data_only=False)
output_path = "F:/Vanya/auto_calc_inspect.txt"

with open(output_path, "w", encoding="utf-8") as f:
    f.write("=== INSPECT AUTO-CALC EXCEL ===\n")
    f.write(f"Sheets: {wb.sheetnames}\n\n")
    
    for name in wb.sheetnames:
        sheet = wb[name]
        f.write(f"=========================================\n")
        f.write(f"Sheet: {name}\n")
        f.write(f"Dimensions: max_row={sheet.max_row}, max_column={sheet.max_column}\n")
        f.write(f"=========================================\n")
        
        for r in range(1, min(sheet.max_row + 1, 100)):
            vals = []
            for c in range(1, min(sheet.max_column + 1, 20)):
                cell = sheet.cell(row=r, column=c)
                if cell.value is not None:
                    vals.append(f"{cell.coordinate}: {cell.value}")
            if vals:
                f.write(f"Row {r}: " + " | ".join(vals) + "\n")
        f.write("\n\n")

print(f"Excel inspected. Output written to {output_path}")
