# excel_utils.py
import pandas as pd
import re

def extract_violations_for_file(excel_path: str, target_file: str) -> str:
    df = pd.read_excel(excel_path, engine="openpyxl", usecols="A:F")

    def parse_line_warning(text):
        match = re.match(r"\[Line (\d+)\]\s*(.+)", str(text))
        return (int(match.group(1)), match.group(2)) if match else (None, text)

    df[['Line', 'Warning']] = df['Line and Warning'].apply(lambda x: pd.Series(parse_line_warning(x)))

    filtered_df = df[df['File'] == target_file]

    if filtered_df.empty:
        return ""

    # Format for Gemini
    # violations = []
    # for _, row in filtered_df.iterrows():
    #     violations.append(
    #         f"File: {row['File']}\n"
    #         f"Path: {row['Path']}\n"
    #         f"Line: {row['Line']}\n"
    #         f"Rule: {row['Misra']}\n"
    #         f"Message: {row['Warning']}\n"
    #     )

    # return "\n".join(violations)

    return filtered_df.to_string(index=False)
