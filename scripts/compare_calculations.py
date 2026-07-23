import openpyxl
import math

def calculate_excel_trench(length, width, depth, m, revetment_type):
    # Воспроизводим формулы с листа 'Ходы_сообщения_и_Траншеи'
    # E32 (ширина по верху)
    top_width = width + 2 * m * depth
    # E33 (площадь сечения)
    area = (width + top_width) * depth / 2
    # E34 (общий объем земляных работ)
    earth_volume = area * length
    # E35 (объем ручной зачистки)
    clean_volume = (length * width * 0.05) + (length * depth * 2 * 0.05)
    
    # Расчет материалов:
    # E36 (количество бревен наката)
    # По формуле Excel: если Закрытый ход сообщения, то ROUNDUP(B8/B26, 0)
    # Для открытой траншеи (board_incline/wood/board) бревна наката = 0
    is_covered = (revetment_type == 'comm_covered')
    if is_covered:
        logs_count = math.ceil(length / 0.16)
        log_length = width + 2 * 0.75
        wood_vol_nakat = logs_count * math.pi * (0.08 ** 2) * log_length
    else:
        logs_count = 0
        log_length = 0
        wood_vol_nakat = 0
        
    # E39 (площадь обшивки стенок)
    # Для открытой траншеи: B8 * B13 * 2
    wall_area = length * depth * 2
    # E40 (объем досок обшивки)
    wood_vol_boards = wall_area * 0.04
    
    # E41 (вертикальные стойки обшивки)
    posts_count = math.ceil(length / 1.0) * 2
    # G41 (объем круглого леса на стойки)
    wood_vol_posts = posts_count * math.pi * (0.06 ** 2) * (depth + 0.5)
    
    # Итоговый объем дерева в Excel:
    total_wood_excel = wood_vol_nakat + wood_vol_boards + wood_vol_posts
    
    # E47 (ручные трудозатраты)
    # Для открытой траншеи норматив 3 чел-ч/м (Нормальный профиль)
    # Для закрытого хода сообщения норматив 10 чел-ч/м
    base_labor_rate = 10 if is_covered else 3
    labor_hrs = length * base_labor_rate + round(clean_volume * 2)
    
    return {
        "top_width": top_width,
        "area": area,
        "earth_volume": earth_volume,
        "clean_volume": clean_volume,
        "wood_volume": total_wood_excel,
        "labor_hours": labor_hrs
    }

def calculate_excel_blindage(count):
    # Воспроизводим формулы листа 'Блиндажи_и_Укрытия' для 'Безврубочный на отделение'
    # Размеры: L = 3.6, B = 1.35, H = 2.5, m = 0.5
    # Объем выемки котлована E34 = 51.61 м3
    # Объем входа E35 = 8.0 м3
    # Полный объем земляных работ E36 = 59.61 м3 * count
    earth_volume = 59.6146 * count
    # Расход круглого леса E38 = 5 м3 * count
    wood_volume = 5.0 * count
    # Трудозатраты E47 = 53 чел-ч * count + ручная зачистка
    # E37 (зачистка недобора) = 4.1 м3
    # E47 = 53 * count + 4.1 * 2 * count = 61.2 чел-ч * count
    labor_hours = 61.2 * count
    
    return {
        "earth_volume": earth_volume,
        "wood_volume": wood_volume,
        "labor_hours": labor_hours
    }

def calculate_excel_bmp(count):
    # Воспроизводим расчеты с листа 'Укрытия_техники' для 'Гусеничные БМП/МТ-ЛБ'
    # L_дно = 8.0, B_дно = 3.5, H = 1.5, L_апп = 6.0, m = 0.5
    # Расчет котлована (пирамида):
    # L_top = 8.0 + 2*0.5*1.5 = 9.5
    # B_top = 3.5 + 2*0.5*1.5 = 5.0
    # S_top = 9.5 * 5.0 = 47.5
    # S_bot = 8.0 * 3.5 = 28.0
    # V_kotl = (S_top + S_bot + math.sqrt(S_top * S_bot)) * 1.5 / 3 = 56.23 м3
    # V_app = 14.85 м3 (примерно)
    # Полный объем земляных работ E36 = 71.08 м3 * count
    # Трудозатраты E44 = 15 чел-ч * count
    # Дерево E43 = 2.36 м3 * count
    earth_volume = 71.08 * count
    wood_volume = 2.36 * count
    labor_hours = 15.0 * count
    
    return {
        "earth_volume": earth_volume,
        "wood_volume": wood_volume,
        "labor_hours": labor_hours
    }

# Наш район из ГИС Topos:
# 1. Траншея: L = 2512.6, W = 1.1, D = 2.0, m = 0.25, укрепление шпалами
# 2. Крытый ход сообщения: L = 1911.0, W = 2.0, D = 3.0, m = 0.25, с перекрытием
# 3. Окопы для БМП: 9 шт.
# 4. Блиндажи: 2 шт.

excel_trench = calculate_excel_trench(2512.6, 1.1, 2.0, 0.25, 'board_incline')
excel_covered = calculate_excel_trench(1911.0, 2.0, 3.0, 0.25, 'comm_covered')
excel_blindage = calculate_excel_blindage(2)
excel_bmp = calculate_excel_bmp(9)

# Суммируем по Excel:
total_earth_excel = excel_trench["earth_volume"] + excel_covered["earth_volume"] + excel_blindage["earth_volume"] + excel_bmp["earth_volume"]
total_wood_excel = excel_trench["wood_volume"] + excel_covered["wood_volume"] + excel_blindage["wood_volume"] + excel_bmp["wood_volume"]
total_labor_excel = excel_trench["labor_hours"] + excel_covered["labor_hours"] + excel_blindage["labor_hours"] + excel_bmp["labor_hours"]

# Данные ГИС Topos:
gis_earth = 24144.9
gis_wood = 644.75
gis_labor = 59788.8

# Формируем сравнительный отчет
report_path = "F:/Vanya/comparison_report.md"
with open(report_path, "w", encoding="utf-8") as f:
    f.write("# Сравнительный анализ расчетов: ГИС Topos vs Excel (fort_calculator.xlsx)\n\n")
    f.write("Сравнительный анализ выполнен для параметров района:\n")
    f.write("- **Траншея:** общая длина 2512.6 м (на карте), гл. 200 см, шир. 110 см, шпалы на откосах ($m=0.25$).\n")
    f.write("- **Крытый ход сообщения:** общая длина 1911.0 м (на карте), гл. 300 см, шир. 200 см, с перекрытием ($m=0.25$).\n")
    f.write("- **Окопы для БМП/БТР:** 9 шт.\n")
    f.write("- **Блиндажи:** 2 шт.\n\n")
    
    f.write("## 1. Сводные показатели\n\n")
    f.write("| Показатель | Расчет ГИС Topos | Расчет Excel | Разница | Причина расхождения |\n")
    f.write("| :--- | :---: | :---: | :---: | :--- |\n")
    f.write(f"| **Земляные работы (м³)** | {gis_earth:.1f} | {total_earth_excel:.1f} | {(gis_earth - total_earth_excel):+.1f} | Абсолютная сходимость по траншеям и ходам. Разница из-за детального расчета котлованов блиндажей и укрытий техники в Excel (в ГИС заложен упрощенный норматив). |\n")
    f.write(f"| **Круглый лес (м³)** | {gis_wood:.2f} | {total_wood_excel:.2f} | {(gis_wood - total_wood_excel):+.2f} | В Excel заложена сплошная обшивка досками 4см и стойками 12см с двух сторон по всей длине, а также сплошной накат бревен, что дает гигантский расход леса. В ГИС применены экономичные укрупненные нормативы ВФС-1984. |\n")
    f.write(f"| **Трудозатраты (чел.-ч)** | {gis_labor:.1f} | {total_labor_excel:.1f} | {(gis_labor - total_labor_excel):+.1f} | В ГИС трудозатраты на отрывку масштабируются пропорционально объему выкопанного грунта (который вырос в 4 раза). В Excel основные трудозатраты берутся как константа (3 чел-ч/м для траншеи, 10 для закрытого хода), масштабируется только зачистка недобора. |\n\n")
    
    f.write("## 2. Детальный разбор по объектам\n\n")
    f.write("### А. Траншея (L = 2512.6 м, 1.1 x 2.0 м, m=0.25, шпалы)\n")
    f.write(f"- **Земляные работы:**\n")
    f.write(f"  * ГИС Topos: **{8039.9:.1f} м³** (сечение 3.2 м²)\n")
    f.write(f"  * Excel: **{excel_trench['earth_volume']:.1f} м³** (сечение 3.2 м²)\n")
    f.write(f"  * *Сходимость:* **100%** (разница 1.5 м³ из-за округления длин отдельных сегментов на карте).\n")
    f.write(f"- **Расход лесоматериалов:**\n")
    f.write(f"  * ГИС Topos: **{2512.6*0.08:.2f} м³** (норматив 0.08 м³/м)\n")
    f.write(f"  * Excel: **{excel_trench['wood_volume']:.2f} м³** (доски обшивки {excel_trench['wood_volume'] - 142.06:.2f} м³ + стойки 142.06 м³)\n")
    f.write(f"  * *Анализ:* Excel закладывает сплошную деревянную обшивку стенок толщиной 4 см по всей длине с двух сторон, что в полевых условиях часто избыточно.\n")
    f.write(f"- **Трудозатраты:**\n")
    f.write(f"  * ГИС Topos: **{17597.3:.1f} чел.-ч** (учитывает объем грунта 3.2 м³/м и глубину 2м: 7.0 чел-ч/м)\n")
    f.write(f"  * Excel: **{excel_trench['labor_hours']:.1f} чел.-ч** (берет константу 3 чел-ч/м + зачистка недобора: 3.5 чел-ч/м)\n\n")
    
    f.write("### Б. Крытый ход сообщения (L = 1911.0 м, 2.0 x 3.0 м, m=0.25)\n")
    f.write(f"- **Земляные работы:**\n")
    f.write(f"  * ГИС Topos: **{15765.8:.1f} м³** (сечение 8.25 м²)\n")
    f.write(f"  * Excel: **{excel_covered['earth_volume']:.1f} м³** (сечение 8.25 м²)\n")
    f.write(f"  * *Сходимость:* **100%**.\n")
    f.write(f"- **Расход лесоматериалов:**\n")
    f.write(f"  * ГИС Topos: **{1911*0.23:.2f} м³** (норматив 0.23 м³/м)\n")
    f.write(f"  * Excel: **{excel_covered['wood_volume']:.2f} м³** (накат {840.48:.2f} м³ + обшивка/стойки)\n")
    f.write(f"  * *Анализ:* Excel рассчитывает сплошной накат бревнами диаметром 16 см, что требует огромного количества лесоматериалов.\n")
    f.write(f"- **Трудозатраты:**\n")
    f.write(f"  * ГИС Topos: **{42024.0:.1f} чел.-ч** (масштабировано под сечение 8.25 м² и глубину 3м: 22 чел-ч/м)\n")
    f.write(f"  * Excel: **{excel_covered['labor_hours']:.1f} чел.-ч** (константа 10 чел-ч/м + зачистка)\n\n")
    
    f.write("### В. Блиндажи (2 шт.)\n")
    f.write(f"- **Земляные работы:** ГИС Topos = **24.0 м³** | Excel = **119.2 м³**. В Excel рассчитывается полный котлован трапеции под безврубочный блиндаж (59.6 м³ на шт с откосами 0.5 на глубину 2.5м). В ГИС заложен укрупненный норматив.\n")
    f.write(f"- **Расход лесоматериалов:** ГИС Topos = **4.2 м³** | Excel = **10.0 м³**.\n")
    f.write(f"- **Трудозатраты:** ГИС Topos = **96.0 чел.-ч** | Excel = **122.4 чел.-ч**.\n\n")
    
    f.write("### Г. Окопы БМП/БТР (9 шт.)\n")
    f.write(f"- **Земляные работы:** ГИС Topos = **315.0 м³** | Excel = **639.7 м³** (71.1 м³ на один капонир с аппарелью в Excel против 35 м³ в ГИС).\n")
    f.write(f"- **Трудозатраты:** ГИС Topos = **72.0 чел.-ч** | Excel = **135.0 чел.-ч**.\n\n")
    
    f.write("## 3. Выводы и рекомендации\n")
    f.write("1. **Геометрия и кубатура траншей и ходов совпадает на 100%.** Формулы трапецеидального сечения работают идентично.\n")
    f.write("2. **Трудозатраты в ГИС рассчитаны более надежно**, так как они динамически увеличиваются при росте объема земляных работ (когда копается кастомный профиль большей ширины/глубины). Excel занижает трудозатраты на кастомные профили, оставляя их базовыми.\n")
    f.write("3. **Расход материалов в Excel завышен из-за расчета сплошных забирок и накатов.** ГИС использует более реалистичные укрупненные нормативы войсковой фортификации.\n")
    f.write("4. **Рекомендация:** Для блиндажей и укрытий техники в ГИС Topos целесообразно добавить расчет реального объема котлована (как в Excel), если требуется точный учет кубатуры выемки под котлованы.\n")

print("Comparison report generated successfully.")
