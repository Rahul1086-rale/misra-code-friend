import pandas as pd
import re
import sys
import json

def extract_violations_for_file(excel_path: str, target_file: str) -> list:
    try:
        df = pd.read_excel(excel_path, engine="openpyxl", usecols="A:F")

        def parse_line_warning(text):
            match = re.match(r"\[Line (\d+)\]\s*(.+)", str(text))
            return (int(match.group(1)), match.group(2)) if match else (None, text)

        df[['Line', 'Warning']] = df['Line and Warning'].apply(lambda x: pd.Series(parse_line_warning(x)))

        filtered_df = df[df['File'] == target_file]

        if filtered_df.empty:
            return []

        # Convert to list of dictionaries
        violations = []
        for _, row in filtered_df.iterrows():
            violations.append({
                'File': row['File'],
                'Path': row['Path'],
                'Line': int(row['Line']) if pd.notna(row['Line']) else None,
                'Warning': row['Warning'],
                'Level': row['Level'] if 'Level' in row else '',
                'Misra': row['Misra']
            })

        return violations
    except Exception as e:
        print(f"Error parsing Excel file: {str(e)}", file=sys.stderr)
        return []

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python excel_utils.py <excel_path> <target_file>")
        sys.exit(1)
    
    excel_path = sys.argv[1]
    target_file = sys.argv[2]
    
    violations = extract_violations_for_file(excel_path, target_file)
    print(json.dumps(violations))